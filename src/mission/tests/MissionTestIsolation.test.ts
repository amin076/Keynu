import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { createIsolatedMissionManager } from "./createIsolatedMissionManager.js";

const liveStatePath = ".keynu/missions/state.json";
const before = readFileSync(liveStatePath, "utf8");
const fixture = createIsolatedMissionManager();
try {
  fixture.manager.prepare();
} finally {
  fixture.dispose();
}
const after = readFileSync(liveStatePath, "utf8");
assert.equal(after, before);
console.log("Mission test isolation regression tests passed.");
