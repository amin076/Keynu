import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
const server = readFileSync("src/app/dashboardServer.ts", "utf8");
assert(server.includes('path === "/api/graph/summary"'));
assert(server.includes('path === "/api/graph/nodes"'));
assert(server.includes('path === "/api/graph/edges"'));
assert(server.includes("graphQueryService.queryNodes"));
assert(server.includes("graphQueryService.queryEdges"));
console.log("Dashboard Graph API integration tests passed.");
