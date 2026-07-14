import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/dashboardHtml.ts", "utf8");

assert(source.includes('id="graphEventCount"'));
assert(source.includes('id="graphLatestEvent"'));
assert(source.includes('id="graphEventAvailable"'));
assert(source.includes('id="graphEvents"'));
assert(source.includes("function loadGraphEvents"));
assert(source.includes("/api/graph/events/summary"));
assert(source.includes("/api/graph/events?limit=30"));
assert(source.includes("No runtime graph events yet"));

console.log("Graph live events Dashboard tests passed.");
