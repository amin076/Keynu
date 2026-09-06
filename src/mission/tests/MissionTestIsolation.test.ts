import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { createIsolatedMissionManager } from "./createIsolatedMissionManager.js";

const liveStatePath = ".keynu/missions/state.json";
const existedBefore = existsSync(liveStatePath);
const before = existedBefore ? readFileSync(liveStatePath, "utf8") : undefined;

const fixture = createIsolatedMissionManager();
try {
  fixture.manager.prepare();
} finally {
  fixture.dispose();
}

assert.equal(
  existsSync(liveStatePath),
  existedBefore,
  "An isolated mission test must not create or delete the developer runtime state file.",
);

if (existedBefore) {
  const after = readFileSync(liveStatePath, "utf8");
  assert.equal(after, before);
}

console.log("Mission test isolation regression tests passed.");
