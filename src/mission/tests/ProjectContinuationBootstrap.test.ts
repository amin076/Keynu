import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createIsolatedMissionManager } from "./createIsolatedMissionManager.js";

const fixture = createIsolatedMissionManager();

try {
  const expectedMission = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "config",
        "missions",
        "keynu",
        "runtime-readiness-melakat.json",
      ),
      "utf8",
    ),
  );

  const bootstrap = fixture.manager.prepare();
  const continuation = bootstrap.payload.context.continuation;

  assert.equal(bootstrap.payload.missionId, expectedMission.id);
  assert.equal(continuation.currentMilestone, expectedMission.currentMilestone);
  assert.deepEqual(continuation.pendingMilestones, expectedMission.nextMilestones);
  assert.deepEqual(
    continuation.architectureDecisions,
    expectedMission.architectureDecisions,
  );
  assert.deepEqual(
    continuation.recommendedReading,
    expectedMission.recommendedReading,
  );
  assert.deepEqual(continuation.knownLimitations, expectedMission.knownLimitations);
  assert.deepEqual(continuation.nextActions, expectedMission.nextActions);
  assert.equal(
    bootstrap.payload.context.openTasks[0],
    expectedMission.nextMilestones[0],
  );

  console.log("Project Continuation Bootstrap tests passed.");
} finally {
  fixture.dispose();
}
