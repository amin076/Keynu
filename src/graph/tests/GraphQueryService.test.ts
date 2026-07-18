import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { GraphQueryService } from "../GraphQueryService.js";

const root = mkdtempSync(join(tmpdir(), "keynu-graph-query-"));
const snapshotPath = join(root, "snapshot.json");
writeFileSync(snapshotPath, JSON.stringify({
  version: "1.0",
  projectRoot: root,
  generatedAt: new Date().toISOString(),
  nodes: [
    { id: "project:test", label: "test", kind: "project", state: "idle" },
    { id: "folder:src", label: "src", kind: "folder", path: "src", state: "idle" },
    { id: "file:src/index.ts", label: "index.ts", kind: "file", path: "src/index.ts", state: "active" },
  ],
  edges: [
    { id: "project:test->folder:src", source: "project:test", target: "folder:src", kind: "contains", state: "idle" },
    { id: "folder:src->file:src/index.ts", source: "folder:src", target: "file:src/index.ts", kind: "contains", state: "active" },
  ],
}, null, 2));

try {
  const service = new GraphQueryService(snapshotPath);
  const summary = service.getSummary();
  assert.equal(summary.available, true);
  assert.equal(summary.nodeCount, 3);
  assert.equal(summary.projectName, basename(root));
  assert.equal("projectRoot" in summary, false);
  assert.equal(summary.edgeCount, 2);
  assert.equal(summary.nodeKinds.file, 1);
  assert.equal(service.queryNodes({ nodeKind: "file" }).total, 1);
  assert.equal(service.queryNodes({ search: "index" }).items[0]?.id, "file:src/index.ts");
  assert.equal(service.queryNodes({ limit: 10000 }).limit, 500);
  assert.equal(service.queryEdges({ edgeState: "active" }).total, 1);
  console.log("GraphQueryService tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
