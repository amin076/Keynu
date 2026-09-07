import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JobCommunicationCenter } from "../JobCommunicationCenter.js";
import { PersistentJobStore } from "../../runtime/PersistentJobStore.js";

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const root = await mkdtemp(join(tmpdir(), "keynu-job-communication-"));

try {
  const sent: string[] = [];
  let terminalAttempts = 0;
  const store = new PersistentJobStore(root);

  const center = new JobCommunicationCenter(
    async (message) => {
      if (message.includes('"type": "REPORT"')) {
        terminalAttempts += 1;
        if (terminalAttempts < 3) {
          throw new Error(`simulated delivery failure ${terminalAttempts}`);
        }
      }
      sent.push(message);
    },
    {
      cwd: root,
      jobStore: store,
      heartbeatIntervalMs: 8,
      stallWarningMs: 12,
      statusMinIntervalMs: 0,
      reportDeliveryAttempts: 4,
      reportRetryDelaysMs: [1, 1, 1],
    },
  );

  const kap = {
    protocol: "KAP" as const,
    version: "1.0",
    type: "JOB",
    id: "job-communication-test",
    createdAt: new Date().toISOString(),
    metadata: {
      missionId: "mission-test",
      workflowId: "workflow-test",
    },
    payload: {
      target: "powershell",
      cwd: root,
    },
  };

  await store.claim(kap.id);
  await center.received(kap);
  await center.analyzed(kap, { commandCount: 2 });
  await store.set(kap.id, "RUNNING");
  await center.started(kap);
  await center.progress(kap, {
    stage: "STARTED",
    phase: "command",
    index: 1,
    total: 2,
    name: "npm test",
  });
  await center.progress(kap, {
    stage: "COMPLETED",
    phase: "command",
    index: 1,
    total: 2,
    name: "npm test",
  });

  await sleep(28);
  await center.terminal(kap, "COMPLETED");

  const reportText = [
    "```kap",
    JSON.stringify(
      {
        protocol: "KAP",
        version: "1.0",
        type: "REPORT",
        id: `report-${kap.id}`,
        createdAt: new Date().toISOString(),
        payload: {
          jobId: kap.id,
          status: "COMPLETED",
        },
      },
      null,
      2,
    ),
    "```",
  ].join("\n");

  const delivery = await center.deliverTerminalReport(
    kap,
    "COMPLETED",
    reportText,
    `report-${kap.id}`,
  );

  assert.equal(delivery.delivered, true);
  assert.equal(delivery.attempts, 3);
  assert.equal(terminalAttempts, 3);

  const stored = await store.get(kap.id);
  assert.equal(stored?.state, "COMPLETED");
  assert.equal(stored?.reportDeliveryAttempts, 3);
  assert.equal(typeof stored?.reportDeliveredAt, "string");
  assert.equal(stored?.lastReportDeliveryError, undefined);

  assert(sent.some((message) => message.includes('"stage": "RECEIVED"')));
  assert(sent.some((message) => message.includes('"stage": "ANALYZED"')));
  assert(sent.some((message) => message.includes('"stage": "STARTED"')));
  assert(sent.some((message) => message.includes('"stage": "STEP_STARTED"')));
  assert(sent.some((message) => message.includes('"stage": "STEP_COMPLETED"')));
  assert(sent.some((message) => message.includes('"stage": "HEARTBEAT"')));
  assert(sent.some((message) => message.includes('"type": "REPORT"')));

  const audit = await readFile(
    join(root, ".keynu", "state", "job-communications.jsonl"),
    "utf8",
  );
  assert(audit.includes('"stage":"RECEIVED"'));
  assert(audit.includes('"stage":"STATUS_DELIVERED"'));
  assert(audit.includes('"stage":"HEARTBEAT"'));
  assert(audit.includes('"stage":"REPORT_PERSISTED"'));
  assert(audit.includes('"stage":"REPORT_DELIVERY_FAILED"'));
  assert(audit.includes('"stage":"REPORT_DELIVERED"'));

  const recoveryJobId = "job-restart-recovery-test";
  await store.claim(recoveryJobId);
  const recoveryReport = [
    "```kap",
    JSON.stringify(
      {
        protocol: "KAP",
        version: "1.0",
        type: "REPORT",
        id: `report-${recoveryJobId}`,
        createdAt: new Date().toISOString(),
        payload: {
          jobId: recoveryJobId,
          status: "COMPLETED",
        },
      },
      null,
      2,
    ),
    "```",
  ].join("\n");
  await store.recordReport(
    recoveryJobId,
    "COMPLETED",
    recoveryReport,
    `report-${recoveryJobId}`,
  );

  const recoveredMessages: string[] = [];
  const restartedCenter = new JobCommunicationCenter(
    async (message) => {
      recoveredMessages.push(message);
    },
    {
      cwd: root,
      jobStore: store,
      reportDeliveryAttempts: 2,
      reportRetryDelaysMs: [1],
    },
  );

  const recovered = await restartedCenter.recoverUndeliveredReports();
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0]?.delivered, true);
  assert.equal(recoveredMessages.length, 1);
  assert(recoveredMessages[0]?.includes(`report-${recoveryJobId}`));

  const recoveredStored = await store.get(recoveryJobId);
  assert.equal(typeof recoveredStored?.reportDeliveredAt, "string");
  assert.equal(recoveredStored?.reportDeliveryAttempts, 1);

  // A slow/busy chat transport must not delay lifecycle advancement or the
  // underlying executor. The first status delivery is deliberately held open;
  // RECEIVED/ANALYZED/STARTED must still return because only durable audit is
  // synchronous. The terminal report later waits for queued statuses so order
  // remains deterministic.
  let releaseBlockedStatus!: () => void;
  let markStatusStarted!: () => void;
  const blockedStatus = new Promise<void>((resolve) => {
    releaseBlockedStatus = resolve;
  });
  const statusStarted = new Promise<void>((resolve) => {
    markStatusStarted = resolve;
  });
  let statusStartMarked = false;
  const nonBlockingJobId = "job-nonblocking-status-test";
  const nonBlockingStore = new PersistentJobStore(root);
  const nonBlockingCenter = new JobCommunicationCenter(
    async (message) => {
      if (message.includes('"type": "JOB_STATUS"')) {
        if (!statusStartMarked) {
          statusStartMarked = true;
          markStatusStarted();
        }
        await blockedStatus;
      }
    },
    {
      cwd: root,
      jobStore: nonBlockingStore,
      heartbeatIntervalMs: 100000,
      statusMinIntervalMs: 0,
      reportDeliveryAttempts: 1,
    },
  );
  const nonBlockingKap = {
    ...kap,
    id: nonBlockingJobId,
  };

  await nonBlockingStore.claim(nonBlockingJobId);
  const receivedWithoutTransport = await Promise.race([
    nonBlockingCenter.received(nonBlockingKap).then(() => true),
    sleep(50).then(() => false),
  ]);
  assert.equal(
    receivedWithoutTransport,
    true,
    "RECEIVED audit must not wait for a blocked browser status transport",
  );
  await statusStarted;
  await nonBlockingCenter.analyzed(nonBlockingKap, { commandCount: 1 });
  await nonBlockingStore.set(nonBlockingJobId, "RUNNING");
  await nonBlockingCenter.started(nonBlockingKap);
  await nonBlockingCenter.terminal(nonBlockingKap, "COMPLETED");

  releaseBlockedStatus();
  const nonBlockingReport = [
    "```kap",
    JSON.stringify(
      {
        protocol: "KAP",
        version: "1.0",
        type: "REPORT",
        id: `report-${nonBlockingJobId}`,
        createdAt: new Date().toISOString(),
        payload: { jobId: nonBlockingJobId, status: "COMPLETED" },
      },
      null,
      2,
    ),
    "```",
  ].join("\n");
  const nonBlockingDelivery = await nonBlockingCenter.deliverTerminalReport(
    nonBlockingKap,
    "COMPLETED",
    nonBlockingReport,
    `report-${nonBlockingJobId}`,
  );
  assert.equal(nonBlockingDelivery.delivered, true);

  console.log("Job communication center tests passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
