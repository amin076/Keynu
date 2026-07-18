import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MissionStateStore } from "../MissionStateStore.js";

const root = mkdtempSync(join(tmpdir(), "keynu-recovery-state-"));
const statePath = join(root, "state.json");

try {
  const store = new MissionStateStore(statePath);
  store.write({
    version: "1.0",
    activeProjectId: "keynu",
    activeMissionId: "knowledge-graph-engine",
    missions: {
      "knowledge-graph-engine": {
        missionId: "knowledge-graph-engine",
        projectId: "keynu",
        status: "ACTIVE",
        currentMilestone: "Clean New-Chat Recovery Verification",
        updatedAt: new Date().toISOString(),
        lastRecoveryTest: {
          status: "VERIFIED",
          missionAcknowledged: true,
          acknowledgementId: "mission-ack-test",
          recordedAt: new Date().toISOString(),
        },
      },
    },
    updatedAt: new Date().toISOString(),
  });

  const updated = store.setActiveMission(
    "keynu",
    "knowledge-graph-engine",
    "Mission dashboard panel",
  );

  assert.equal(updated.currentMilestone, "Mission dashboard panel");
  assert.equal(updated.lastRecoveryTest?.status, "VERIFIED");
  assert.equal(updated.lastRecoveryTest?.acknowledgementId, "mission-ack-test");
  console.log("Mission recovery state persistence tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
