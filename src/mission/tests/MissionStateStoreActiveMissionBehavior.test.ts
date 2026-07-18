import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MissionStateStore } from "../MissionStateStore.js";

const root = mkdtempSync(join(tmpdir(), "keynu-active-mission-behavior-"));
const statePath = join(root, "state.json");

try {
  const store = new MissionStateStore(statePath);

  const activated = store.setActiveMission(
    "project-alpha",
    "mission-alpha",
    "Verify active mission switching behavior",
  );

  const state = store.read();

  assert.equal(activated.projectId, "project-alpha");
  assert.equal(activated.missionId, "mission-alpha");
  assert.equal(
    activated.currentMilestone,
    "Verify active mission switching behavior",
  );
  assert.equal(state.activeProjectId, "project-alpha");
  assert.equal(state.activeMissionId, "mission-alpha");
  assert.equal(state.missions["mission-alpha"]?.projectId, "project-alpha");
  assert.equal(
    state.missions["mission-alpha"]?.currentMilestone,
    "Verify active mission switching behavior",
  );

  const updated = store.setActiveMission(
    "project-alpha",
    "mission-alpha",
    "Continue graph-driven runtime intelligence",
  );

  const updatedState = store.read();

  assert.equal(
    updated.currentMilestone,
    "Continue graph-driven runtime intelligence",
  );
  assert.equal(
    updatedState.missions["mission-alpha"]?.currentMilestone,
    "Continue graph-driven runtime intelligence",
  );
  assert.equal(
    Object.keys(updatedState.missions).filter(
      (missionId) => missionId === "mission-alpha",
    ).length,
    1,
  );

  console.log("PASS MissionStateStoreActiveMissionBehavior");
} finally {
  rmSync(root, { recursive: true, force: true });
}
