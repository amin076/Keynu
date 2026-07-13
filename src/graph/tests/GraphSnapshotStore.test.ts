import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphSnapshotStore } from "../GraphSnapshotStore.js";
import type { GraphSnapshot } from "../GraphTypes.js";

const root = mkdtempSync(join(tmpdir(), "keynu-graph-store-test-"));
const snapshotPath = join(root, "graph", "snapshot.json");
const snapshot: GraphSnapshot = {
  version: "1.0",
  projectRoot: root,
  generatedAt: new Date().toISOString(),
  nodes: [
    {
      id: "project:test",
      label: "test",
      kind: "project",
      path: root,
      state: "idle",
    },
  ],
  edges: [],
};

try {
  const store = new GraphSnapshotStore(snapshotPath);
  store.write(snapshot);
  const restored = store.read();
  assert.deepEqual(restored, snapshot);
  console.log("GraphSnapshotStore tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
