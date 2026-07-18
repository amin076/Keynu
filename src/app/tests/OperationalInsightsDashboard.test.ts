import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/dashboardHtml.ts", "utf8");

assert(source.includes('data-panel="insights"'));
assert(source.includes('id="insights"'));
assert(source.includes('id="insightUnresolved"'));
assert(source.includes('id="insightRecovered"'));
assert(source.includes('id="insightHistorical"'));
assert(source.includes('id="insightActive"'));
assert(source.includes('id="insightStale"'));
assert(source.includes('id="insightUnmatched"'));
assert(source.includes('id="insightItems"'));
assert(source.includes('id="insightFrequentFiles"'));
assert(source.includes('id="insightImpactFiles"'));
assert(source.includes('function loadOperationalInsights'));
assert(source.includes('/api/graph/operational-insights'));
assert(source.includes('loadOperationalInsights().catch'));

assert(source.includes("historical-missing-path"));
assert(source.includes("Historical paths"));

console.log("Operational Insights Dashboard tests passed.");
