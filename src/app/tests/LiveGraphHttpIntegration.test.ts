import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDashboardServer } from "../dashboardServer.js";
import { DriverManager } from "../../core/DriverManager.js";
import { EffectiveGraphQueryService } from "../../graph/EffectiveGraphQueryService.js";
import { GraphEventStore } from "../../graph/GraphEventStore.js";
import { GraphSnapshotStore } from "../../graph/GraphSnapshotStore.js";

const root = mkdtempSync(join(tmpdir(), "keynu-live-graph-http-"));
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
      id: "file:src/consumer.ts",
      label: "consumer.ts",
      kind: "file",
      path: "src/consumer.ts",
      state: "idle",
    },
  ],
  edges: [
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
  id: "event-http-write",
  jobId: "job-http-example",
  taskId: "job-http-example",
  stepIndex: 0,
  driverId: "powershell",
  type: "node.success",
  nodeId: "runtime-step:job-http-example:write:0",
  time: "2026-07-14T00:00:01.000Z",
  metadata: {
    category: "write",
    path: "src/example.ts",
    driverId: "powershell",
  },
});

const effectiveGraphQueryService = new EffectiveGraphQueryService(
  snapshotStore,
  eventStore,
);

const handle = await startDashboardServer({
  driverManager: new DriverManager(),
  capabilities: [],
  port: 0,
  graphEventStore: eventStore,
  effectiveGraphQueryService,
});

assert(handle, "Dashboard server should start on an ephemeral port.");

try {
  const summaryResponse = await fetch(handle.url + "/api/graph/effective/summary");
  assert.equal(summaryResponse.status, 200);
  const summary = await summaryResponse.json() as any;
  assert.equal(summary.ok, true);
  assert.equal(summary.graph.nodeCount, 4);

  const encodedNodeId = encodeURIComponent("file:src/example.ts");

  const nodeResponse = await fetch(handle.url + "/api/graph/effective/node?nodeId=" + encodedNodeId);
  assert.equal(nodeResponse.status, 200);
  const node = await nodeResponse.json() as any;
  assert.equal(node.node.id, "file:src/example.ts");
  assert.equal(node.node.state, "success");

  const neighborsResponse = await fetch(handle.url + "/api/graph/effective/neighbors?nodeId=" + encodedNodeId + "&depth=1");
  assert.equal(neighborsResponse.status, 200);
  const neighbors = await neighborsResponse.json() as any;
  assert(neighbors.nodes.some((item: any) => item.id === "file:src/consumer.ts"));
  assert(neighbors.nodes.some((item: any) => item.id === "job:job-http-example"));

  const impactResponse = await fetch(handle.url + "/api/graph/effective/impact?nodeId=" + encodedNodeId + "&depth=3");
  assert.equal(impactResponse.status, 200);
  const impact = await impactResponse.json() as any;
  assert.equal(impact.impactedNodes.length, 1);
  assert.equal(impact.impactedNodes[0].id, "file:src/consumer.ts");

  const activityResponse = await fetch(handle.url + "/api/graph/effective/activity?limit=10");
  assert.equal(activityResponse.status, 200);
  const activity = await activityResponse.json() as any;
  assert.equal(activity.total, 1);
  assert.equal(activity.items[0].repositoryNodeId, "file:src/example.ts");

  const missingParameterResponse = await fetch(handle.url + "/api/graph/effective/node");
  assert.equal(missingParameterResponse.status, 400);

  const unknownNodeResponse = await fetch(handle.url + "/api/graph/effective/node?nodeId=" + encodeURIComponent("file:missing.ts"));
  assert.equal(unknownNodeResponse.status, 404);

  console.log("Live Graph HTTP integration tests passed.");




  const impossibleSearchResponse = await fetch(
    handle.url + "/api/graph/effective/nodes?limit=140&search=" +
      encodeURIComponent("__keynu_no_such_node_filter_test__"),
    { cache: "no-store" },
  );
  assert.equal(impossibleSearchResponse.status, 200);
  const impossibleSearch = await impossibleSearchResponse.json() as {
    items?: Array<{ kind?: string }>;
  };
  assert.equal(impossibleSearch.items?.length ?? 0, 0);

  const fileFilterResponse = await fetch(
    handle.url + "/api/graph/effective/nodes?limit=140&kind=file",
    { cache: "no-store" },
  );
  assert.equal(fileFilterResponse.status, 200);
  const fileFilter = await fileFilterResponse.json() as {
    items?: Array<{ kind?: string }>;
  };
  assert((fileFilter.items ?? []).every((node) => node.kind === "file"));

  const jobFilterResponse = await fetch(
    handle.url + "/api/graph/effective/nodes?limit=140&kind=job",
    { cache: "no-store" },
  );
  assert.equal(jobFilterResponse.status, 200);
  const jobFilter = await jobFilterResponse.json() as {
    items?: Array<{ kind?: string }>;
  };
  assert((jobFilter.items ?? []).every((node) => node.kind === "job"));

} finally {
  await handle.close();
  rmSync(root, { recursive: true, force: true });
}
