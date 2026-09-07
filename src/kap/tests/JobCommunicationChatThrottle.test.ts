import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JobCommunicationCenter } from "../JobCommunicationCenter.js";
import { PersistentJobStore } from "../../runtime/PersistentJobStore.js";

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const root = await mkdtemp(join(tmpdir(), "keynu-chat-throttle-"));

try {
  const sent: string[] = [];
  const store = new PersistentJobStore(root);
  const center = new JobCommunicationCenter(
    async (message) => {
      sent.push(message);
    },
    {
      cwd: root,
      jobStore: store,
      heartbeatIntervalMs: 100000,
      statusMinIntervalMs: 30000,
      reportDeliveryAttempts: 1,
    },
  );

  const kap = {
    protocol: "KAP" as const,
    version: "1.0",
    type: "JOB",
    id: "job-chat-throttle",
    createdAt: new Date().toISOString(),
    payload: {
      target: "powershell",
      cwd: root,
    },
  };

  await store.claim(kap.id);
  await center.received(kap);
  await center.analyzed(kap, { readCount: 5 });
  await store.set(kap.id, "RUNNING");
  await center.started(kap);
  await center.progress(kap, {
    stage: "STARTED",
    phase: "read",
    index: 1,
    total: 5,
    name: "memory.md",
  });

  await sleep(10);
  await center.terminal(kap, "COMPLETED");

  assert.equal(
    sent.filter((message) => message.includes('"type": "JOB_STATUS"')).length,
    1,
    "Rapid ANALYZED/STARTED/STEP status events must stay in durable audit instead of creating multiple ChatGPT turns.",
  );
  assert(sent[0]?.includes('"stage": "RECEIVED"'));
  assert.equal(
    sent.some((message) => message.includes('"stage": "ANALYZED"')),
    false,
  );
  assert.equal(
    sent.some((message) => message.includes('"stage": "STARTED"')),
    false,
  );

  console.log("PASS JobCommunicationChatThrottle");
} finally {
  await rm(root, { recursive: true, force: true });
}
