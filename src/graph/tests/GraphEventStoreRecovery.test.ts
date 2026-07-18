import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GraphEventStore } from "../GraphEventStore.js";

const root = mkdtempSync(join(tmpdir(), "keynu-graph-event-recovery-"));
const eventPath = join(root, "events.ndjson");

try {
  writeFileSync(
    eventPath,
    [
      JSON.stringify({
        id: "event-valid-1",
        jobId: "job-1",
        type: "node.success",
        nodeId: "runtime-step:job-1",
        time: "2026-07-14T00:00:01.000Z",
      }),
      "{ malformed json",
      JSON.stringify({
        id: "event-valid-2",
        jobId: "job-2",
        type: "node.failed",
        nodeId: "runtime-step:job-2",
        time: "2026-07-14T00:00:02.000Z",
      }),
      "",
    ].join("\n"),
    "utf8",
  );

  const store = new GraphEventStore(eventPath);
  const diagnostics = store.readAllWithDiagnostics();
  const summary = store.getSummary();
  const query = store.query({ limit: 10 });

  assert.equal(diagnostics.events.length, 2);
  assert.equal(diagnostics.malformedLineCount, 1);
  assert.deepEqual(diagnostics.malformedLines, [2]);
  assert.equal(summary.eventCount, 2);
  assert.equal(summary.malformedLineCount, 1);
  assert.deepEqual(summary.malformedLines, [2]);
  assert.equal(query.total, 2);
  assert.equal(query.items[0]?.id, "event-valid-2");

  console.log("GraphEventStore malformed-line recovery tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
