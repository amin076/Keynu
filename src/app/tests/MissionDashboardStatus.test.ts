import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const server = readFileSync("src/app/dashboardServer.ts", "utf8");
const html = readFileSync("src/app/dashboardHtml.ts", "utf8");

assert(server.includes("const missionManager = new MissionManager()"));
assert(server.includes("const mission = missionManager.getStatus()"));
assert(server.includes("mission,"));
assert(html.includes('data-panel="mission"'));
assert(html.includes('id="missionMilestone"'));
assert(html.includes('id="missionRecovery"'));
assert(html.includes("d.mission?.runtimeState?.lastRecoveryTest?.status"));
assert(html.includes("d.mission?.validation?.checks"));
console.log("Mission Dashboard status integration tests passed.");
