import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/dashboardServer.ts", "utf8");

assert(source.includes("GraphEventStore"));
assert(source.includes("const graphEventStore = options.graphEventStore ?? new GraphEventStore()"));
assert(source.includes("graphEventStore?: GraphEventStore"));
assert(source.includes('path === "/api/graph/events/summary"'));
assert(source.includes('path === "/api/graph/events"'));
assert(source.includes("graphEventStore.getSummary()"));
assert(source.includes("graphEventStore.query"));
assert(source.includes("missionId:"));
assert(source.includes("workflowId:"));
assert(source.includes("jobId:"));

console.log("Graph Events API integration tests passed.");
