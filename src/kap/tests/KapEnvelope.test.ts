import { strict as assert } from "node:assert";
import {
  isKapEnvelope,
  isKapJobEnvelope,
  taskFromKapJob,
  type KapEnvelope,
} from "../KapEnvelope.js";

const task = {
  id: "task-envelope-test",
  createdAt: new Date().toISOString(),
  priority: "normal" as const,
  steps: [],
};

const envelope: KapEnvelope<typeof task> = {
  protocol: "KAP",
  version: "1.0",
  type: "JOB",
  id: "job-envelope-test",
  createdAt: new Date().toISOString(),
  payload: task,
  metadata: {
    correlationId: "correlation-001",
    traceId: "trace-001",
    missionId: "knowledge-graph-engine",
    workflowId: "kap-priority-1-5",
    sequence: 1,
    idempotencyKey: "job-envelope-test",
    contentType: "application/json",
    schema: "kap/job/1.0",
    retry: {
      attempt: 1,
      maximumAttempts: 3,
      retryable: true,
    },
  },
};

assert.equal(isKapEnvelope(envelope), true);
assert.equal(isKapJobEnvelope(envelope), true);
assert.equal(taskFromKapJob(envelope).id, task.id);
assert.equal(envelope.metadata?.correlationId, "correlation-001");
assert.equal(envelope.metadata?.idempotencyKey, "job-envelope-test");
assert.equal(isKapEnvelope({ protocol: "OTHER" }), false);

console.log("KapEnvelope tests passed.");
