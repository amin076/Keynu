import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EffectiveGraphQueryService } from "../EffectiveGraphQueryService.js";
import { GraphEventStore } from "../GraphEventStore.js";
import { GraphSnapshotStore } from "../GraphSnapshotStore.js";

const root = mkdtempSync(join(tmpdir(), "keynu-effective-query-"));

try {
  const snapshotStore = new GraphSnapshotStore(join(root, "snapshot.json"));
  const eventStore = new GraphEventStore(join(root, "events.ndjson"));

  snapshotStore.write({
    version: "1.0",
    projectRoot: root,
    generatedAt: "2026-07-14T00:00:00.000Z",
    nodes: [
      {
        id: "file:src/example.ts",
        label: "example.ts",
        kind: "file",
        path: "src/example.ts",
        state: "idle",
      },
      {
        id: "folder:src",
        label: "src",
        kind: "folder",
        path: "src",
        state: "idle",
      },
      {
        id: "file:src/consumer.ts",
        label: "consumer.ts",
        kind: "file",
        path: "src/consumer.ts",
        state: "idle",
      },
    ],
    edges: [
      {
        id: "folder:src->file:src/example.ts",
        source: "folder:src",
        target: "file:src/example.ts",
        kind: "contains",
        state: "idle",
      },
      {
        id: "file:src/consumer.ts->file:src/example.ts",
        source: "file:src/consumer.ts",
        target: "file:src/example.ts",
        kind: "depends-on",
        state: "idle",
      },
    ],
  });

  eventStore.append({
    id: "event-success",
    jobId: "job-example",
    type: "node.success",
    nodeId: "runtime-step:job-example:write:0",
    time: "2026-07-14T00:00:01.000Z",
    metadata: { path: "src/example.ts" },
  });

  const service = new EffectiveGraphQueryService(
    snapshotStore,
    eventStore,
  );

  const summary = service.getSummary();
  const successfulNodes = service.queryNodes({ kind: "file", state: "success" });
  const searchNodes = service.queryNodes({ kind: "file", search: "example" });
  const allExampleNodes = service.queryNodes({ search: "example" });
  const edges = service.queryEdges({ kind: "contains" });
  const neighbors = service.queryNeighbors("file:src/example.ts", 1);
  const impact = service.queryImpact("file:src/example.ts", 2);
  const recentActivity = service.queryRecentActivity(10);

  assert.equal(summary.nodeCount, 4);
  assert.equal(service.queryNodes({ kind: "job" }).total, 1);
  assert.equal(service.queryNodes({ kind: "job" }).items[0]?.id, "job:job-example");
  assert.equal(summary.nodeStates.success, 2);
  assert.equal(service.queryNodes({ kind: "job", state: "success" }).total, 1);
  assert.equal(summary.projection.matchedRepositoryEvents, 1);
  assert.equal(successfulNodes.total, 1);
  assert.equal(successfulNodes.items[0]?.id, "file:src/example.ts");
  assert.equal(searchNodes.total, 1);
  assert.equal(searchNodes.items[0]?.id, "file:src/example.ts");
  assert.equal(allExampleNodes.total, 2);
  assert(allExampleNodes.items.some((node) => node.id === "job:job-example"));
  assert.equal(edges.total, 1);
  assert.equal(neighbors.node?.id, "file:src/example.ts");
  assert.equal(neighbors.nodes.length, 2);
  assert(neighbors.edges.some((edge) => edge.kind === "depends-on"));
  assert.equal(impact.impactedNodes.length, 1);
  assert.equal(impact.impactedNodes[0]?.id, "file:src/consumer.ts");
  assert.equal(impact.impactEdges[0]?.kind, "depends-on");
  assert.equal(recentActivity.length, 1);
  assert.equal(recentActivity[0]?.repositoryNodeId, "file:src/example.ts");

  console.log("EffectiveGraphQueryService tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
