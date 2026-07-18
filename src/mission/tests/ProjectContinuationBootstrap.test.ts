import { strict as assert } from "node:assert";
import { createIsolatedMissionManager } from "./createIsolatedMissionManager.js";

const fixture = createIsolatedMissionManager();

try {
  const bootstrap = fixture.manager.prepare();
  const continuation = bootstrap.payload.context.continuation;

  assert.equal(bootstrap.payload.missionId, "openai-build-week");
  assert.equal(
    continuation.currentMilestone,
    "Define the winning submission concept and minimum competition-ready demo",
  );
  assert.deepEqual(
    continuation.pendingMilestones,
    [
      "Audit the current working Keynu capabilities that can be demonstrated without speculative rebuilding",
      "Choose one clear competition story and user problem",
      "Build and verify the minimum competition-ready demo",
      "Prepare the demo script and recording",
      "Prepare submission description, evidence, and repository documentation",
      "Complete and verify the submission before the deadline",
    ],
  );
  assert(continuation.architectureDecisions.length >= 4);
  assert.equal(
    continuation.recommendedReading[0]?.path,
    "https://openai.com/build-week/",
  );
  assert.equal(
    continuation.knownLimitations.some((item) =>
      item.includes("does not yet fully validate every message-type payload"),
    ),
    false,
  );
  assert.equal(
    continuation.nextActions[0]?.title,
    "Synchronize and activate the Build Week mission locally",
  );
  assert.equal(
    bootstrap.payload.context.openTasks[0],
    "Audit the current working Keynu capabilities that can be demonstrated without speculative rebuilding",
  );

  console.log("Project Continuation Bootstrap tests passed.");
} finally {
  fixture.dispose();
}
