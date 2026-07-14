import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/dashboardServer.ts", "utf8");

assert(source.includes("EffectiveGraphQueryService"));
assert(source.includes("/api/graph/effective/summary"));
assert(source.includes("/api/graph/effective/nodes"));
assert(source.includes("/api/graph/effective/edges"));
assert(source.includes("effectiveGraphQueryService.getSummary()"));
assert(source.includes("effectiveGraphQueryService.queryNodes"));
assert(source.includes("effectiveGraphQueryService.queryEdges"));
assert(source.includes('/api/graph/effective/node'));
assert(source.includes('/api/graph/effective/neighbors'));
assert(source.includes('/api/graph/effective/impact'));
assert(source.includes('/api/graph/effective/activity'));
assert(source.includes('effectiveGraphQueryService.getNode'));
assert(source.includes('effectiveGraphQueryService.queryNeighbors'));
assert(source.includes('effectiveGraphQueryService.queryImpact'));
assert(source.includes('effectiveGraphQueryService.queryRecentActivity'));


console.log("Effective Graph API tests passed.");
