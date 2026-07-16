import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync("src/mission/MissionStateStore.ts", "utf8");

assert.match(
  source,
  /\bsetActiveMission\s*\(/,
  "MissionStateStore must provide an explicit active-mission switch operation.",
);
assert.match(source, /activeMissionId/);
assert.match(source, /activeProjectId/);

console.log("PASS MissionStateStoreActiveMission");
