import { strict as assert } from "node:assert";
import { RuntimeRelationshipProjector } from "../RuntimeRelationshipProjector.js";
import type { GraphEvent, GraphSnapshot } from "../GraphTypes.js";

const snapshot: GraphSnapshot = {
  version: "1.0",
  projectRoot: "C:/Physics/Keynu",
  generatedAt: "2026-07-14T00:00:00.000Z",
  nodes: [
    {
      id: "file:src/example.ts",
      label: "example.ts",
      kind: "file",
      path: "src/example.ts",
      state: "idle",
    },
  ],
  edges: [],
};

const events: GraphEvent[] = [
  {
    id: "event-queued",
    jobId: "job-example",
    type: "node.queued",
    nodeId: "runtime-step:job-example",
    time: "2026-07-14T00:00:01.000Z",
    metadata: { target: "powershell", phase: "queued" },
  },
  {
    id: "event-read",
    jobId: "job-example",
    taskId: "job-example",
    stepIndex: 0,
    driverId: "powershell",
    type: "node.success",
    nodeId: "runtime-step:job-example:read:0",
    time: "2026-07-14T00:00:02.000Z",
    metadata: { category: "read", path: "src/example.ts", driverId: "powershell" },
  },
  {
    id: "event-command",
    jobId: "job-example",
    taskId: "job-example",
    stepIndex: 1,
    driverId: "powershell",
    type: "node.success",
    nodeId: "runtime-step:job-example:command:1",
    time: "2026-07-14T00:00:03.000Z",
    metadata: { category: "command", command: "npm", driverId: "powershell" },
  },
  {
    id: "event-completed",
    jobId: "job-example",
    type: "node.success",
    nodeId: "runtime-step:job-example",
    time: "2026-07-14T00:00:04.000Z",
    metadata: { target: "powershell", phase: "completed", operationCount: 2 },
  },
];

const result = new RuntimeRelationshipProjector().project(snapshot, events);

assert(result.nodes.some((node) => node.id === "job:job-example" && node.kind === "job"));
assert(result.nodes.some((node) => node.id === "driver:powershell" && node.kind === "driver"));
assert(result.nodes.some((node) => node.id === "runtime-step:job-example:command:1" && node.kind === "command"));
assert(result.nodes.some((node) => node.id === "report:job-example" && node.kind === "report"));
assert(result.edges.some((edge) => edge.source === "job:job-example" && edge.target === "file:src/example.ts" && edge.kind === "reads"));
assert(result.edges.some((edge) => edge.source === "driver:powershell" && edge.target === "job:job-example" && edge.kind === "executes"));
assert(result.edges.some((edge) => edge.source === "job:job-example" && edge.kind === "executes"));
assert(result.edges.some((edge) => edge.source === "report:job-example" && edge.target === "job:job-example" && edge.kind === "reports-to"));

console.log("Runtime relationship projection tests passed.");
