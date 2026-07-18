import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/dashboardHtml.ts", "utf8");

assert(source.includes("/api/graph/effective/nodes?"));
assert(source.includes("/api/graph/effective/edges?limit=150"));
assert(source.includes("/api/graph/effective/summary"));
assert(source.includes("function loadEffectiveGraphSummary"));
assert(source.includes('id="graphEffectiveSuccess"'));
assert(source.includes('id="graphEffectiveActive"'));
assert(source.includes('id="graphEffectiveFailed"'));
assert(source.includes('id="graphMatchedEvents"'));
assert(source.includes("graphColor(n.kind,n.state)"));
assert(source.includes('function loadGraphNodeIntelligence'));
assert(source.includes('/api/graph/effective/neighbors?nodeId='));
assert(source.includes('/api/graph/effective/impact?nodeId='));
assert(source.includes('/api/graph/effective/activity?limit=100'));
assert(source.includes('id="graphNeighborCount"'));
assert(source.includes('id="graphImpactCount"'));
assert(source.includes('id="graphNodeActivityCount"'));
assert(source.includes('id="graphRelatedNodes"'));
assert(source.includes('id="graphImpactNodes"'));


console.log("Effective Graph Dashboard tests passed.");
