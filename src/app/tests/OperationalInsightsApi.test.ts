import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/dashboardServer.ts", "utf8");

assert(source.includes("OperationalInsightsService"));
assert(source.includes("operationalInsightsService?: OperationalInsightsService"));
assert(source.includes("new OperationalInsightsService(effectiveGraphQueryService)"));
assert(source.includes("/api/graph/operational-insights"));
assert(source.includes("operationalInsightsService.getSummary()"));

console.log("Operational insights API tests passed.");
