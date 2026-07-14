import { strict as assert } from "node:assert";
import { EffectiveGraphStateProjector } from "../EffectiveGraphStateProjector.js";
import type { GraphEvent, GraphSnapshot } from "../GraphTypes.js";

const snapshot: GraphSnapshot = {
  version: "1.0",
  projectRoot: "C:/Physics/Keynu",
  generatedAt: "2026-07-14T00:00:00.000Z",
  nodes: [
    {
      id: "project:keynu",
      label: "Keynu",
      kind: "project",
      state: "idle",
    },
    {
      id: "file:src/graph/GraphEventStore.ts",
      label: "GraphEventStore.ts",
      kind: "file",
      path: "src/graph/GraphEventStore.ts",
      state: "idle",
    },
  ],
  edges: [],
};

const events: GraphEvent[] = [
  {
    id: "event-old",
    jobId: "job-old",
    type: "node.active",
    nodeId: "runtime-step:job-old:read:0",
    time: "2026-07-14T00:00:01.000Z",
    metadata: { path: "src/graph/GraphEventStore.ts" },
  },
  {
    id: "event-new",
    jobId: "job-new",
    type: "node.success",
    nodeId: "runtime-step:job-new:write:0",
    time: "2026-07-14T00:00:02.000Z",
    metadata: { path: "src\\graph\\GraphEventStore.ts" },
  },
  {
    id: "event-internal",
    jobId: "job-internal",
    type: "node.success",
    nodeId: "runtime-step:job-internal:read:0",
    time: "2026-07-14T00:00:03.000Z",
    metadata: { path: ".keynu/memory/current_state.md" },
  },
  {
    id: "event-unmatched",
    jobId: "job-unmatched",
    type: "node.failed",
    nodeId: "runtime-step:job-unmatched:read:0",
    time: "2026-07-14T00:00:04.000Z",
    metadata: { path: "src/missing.ts" },
  },
  {
    id: "event-no-path",
    jobId: "job-no-path",
    type: "node.queued",
    nodeId: "runtime-step:job-no-path",
    time: "2026-07-14T00:00:05.000Z",
  },
];

const result = new EffectiveGraphStateProjector().project(snapshot, events);
const fileNode = result.snapshot.nodes.find(
  (node) => node.id === "file:src/graph/GraphEventStore.ts",
);

assert.equal(fileNode?.state, "success");
assert.equal(fileNode?.metadata?.latestRuntimeEventId, "event-new");
assert.equal(result.summary.eventCount, 5);
assert.equal(result.summary.repositoryPathEvents, 3);
assert.equal(result.summary.matchedRepositoryEvents, 2);
assert.equal(result.summary.unmatchedRepositoryEvents, 1);
assert.equal(result.summary.excludedInternalEvents, 1);
assert.equal(result.summary.eventsWithoutPath, 1);
assert.equal(result.summary.invalidPathEvents, 0);

const internal = result.correlations.find(
  (item) => item.eventId === "event-internal",
);
assert.equal(internal?.classification, "excluded-internal");
assert.equal(internal?.repositoryNodeId, undefined);

console.log("EffectiveGraphStateProjector tests passed.");
