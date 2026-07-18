import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GraphEventStore } from "../GraphEventStore.js";

const root = mkdtempSync(join(tmpdir(), "keynu-graph-event-rotation-"));
const eventPath = join(root, "events.ndjson");

try {
  const store = new GraphEventStore(eventPath, {
    maximumBytes: 420,
    retainedEvents: 2,
  });

  for (let index = 0; index < 8; index += 1) {
    store.append({
      id: `event-${index}`,
      jobId: `job-${index}`,
      type: "node.success",
      nodeId: `runtime-step:job-${index}`,
      time: `2026-07-14T00:00:0${index}.000Z`,
      metadata: { payload: "x".repeat(70) },
    });
  }

  const events = store.readAll();
  const summary = store.getSummary();
  const raw = readFileSync(eventPath, "utf8");

  assert(events.length <= 3);
  assert.equal(events.at(-1)?.id, "event-7");
  assert(events.some((event) => event.id === "event-6"));
  assert.equal(summary.maximumBytes, 420);
  assert.equal(summary.retainedEvents, 2);
  assert.equal(summary.malformedLineCount, 0);
  assert(!existsSync(eventPath + ".rotation.tmp"));
  assert(!existsSync(eventPath + ".rotation.bak"));
  assert(raw.endsWith("\n"));

  console.log("GraphEventStore safe rotation tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
