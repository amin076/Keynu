import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GraphEventStore } from "../GraphEventStore.js";
import { RuntimeGraphTracer } from "../RuntimeGraphTracer.js";

const root = mkdtempSync(join(tmpdir(), "keynu-runtime-graph-tracer-"));
const eventPath = join(root, "events.ndjson");

try {
  const store = new GraphEventStore(eventPath);
  const tracer = new RuntimeGraphTracer(store);
  const context = {
    jobId: "job-runtime-trace-001",
    missionId: "knowledge-graph-engine",
    workflowId: "live-runtime-workflow-tracing",
    target: "powershell",
  };

  tracer.traceQueued(context);
  tracer.traceStarted(context);
  tracer.traceCompleted(context, {
    status: "COMPLETED",
    reads: [{ path: "src/input.ts", ok: true }],
    writes: [{ path: "src/output.ts", ok: true }],
    commands: [{ command: "npm", ok: true }],
  });

  const result = store.query({ jobId: context.jobId, limit: 20 });
  assert.equal(result.total, 6);
  assert.equal(result.items.filter((event) => event.type === "node.queued").length, 1);
  assert.equal(result.items.filter((event) => event.type === "node.active").length, 1);
  assert.equal(result.items.filter((event) => event.type === "node.success").length, 4);
  assert(result.items.some((event) => event.nodeId === "runtime-step:job-runtime-trace-001:read:0"));
  assert(result.items.some((event) => event.nodeId === "runtime-step:job-runtime-trace-001:write:0"));
  assert(result.items.some((event) => event.nodeId === "runtime-step:job-runtime-trace-001:command:0"));
  assert(result.items.every((event) => event.missionId === "knowledge-graph-engine"));
  assert(result.items.every((event) => event.workflowId === "live-runtime-workflow-tracing"));

  tracer.traceFailed(
    { ...context, jobId: "job-runtime-trace-failed" },
    new Error("test failure"),
  );

  const failed = store.query({ jobId: "job-runtime-trace-failed" });
  assert.equal(failed.total, 1);
  assert.equal(failed.items[0]?.type, "node.failed");
  assert.equal(failed.items[0]?.metadata?.error, "test failure");

  console.log("RuntimeGraphTracer tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
