import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JobCommunicationCenter } from "../JobCommunicationCenter.js";
import { PersistentJobStore } from "../../runtime/PersistentJobStore.js";

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
      heartbeatIntervalMs: 100000,
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
  await center.terminal(kap, "COMPLETED");

  const reportText = [
    "```kap",
    JSON.stringify({
      protocol: "KAP",
      version: "1.0",
      type: "REPORT",
      id: `report-${kap.id}`,
      createdAt: new Date().toISOString(),
      payload: {
        jobId: kap.id,
        status: "COMPLETED",
      },
    }, null, 2),
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
  assert(sent.some((message) => message.includes('"type": "REPORT"')));

  const audit = await readFile(
    join(root, ".keynu", "state", "job-communications.jsonl"),
    "utf8",
  );
  assert(audit.includes('"stage":"RECEIVED"'));
  assert(audit.includes('"stage":"REPORT_PERSISTED"'));
  assert(audit.includes('"stage":"REPORT_DELIVERY_FAILED"'));
  assert(audit.includes('"stage":"REPORT_DELIVERED"'));

  console.log("Job communication center tests passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
