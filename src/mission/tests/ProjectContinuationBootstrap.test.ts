import { strict as assert } from "node:assert";
import { createIsolatedMissionManager } from "./createIsolatedMissionManager.js";

const fixture = createIsolatedMissionManager();

try {
  const bootstrap = fixture.manager.prepare();
  const continuation = bootstrap.payload.context.continuation;

  assert.equal(
    continuation.currentMilestone,
    "Graph-driven runtime intelligence",
  );
  assert.deepEqual(
    continuation.pendingMilestones,
    ["Graph-driven runtime intelligence"],
  );
  assert(continuation.architectureDecisions.length >= 4);
  assert.equal(
    continuation.recommendedReading[0]?.path,
    "docs/KAP/KAP_PROTOCOL_V1.md",
  );
  assert.equal(
    continuation.knownLimitations.some((item) =>
      item.includes("does not yet fully validate every message-type payload"),
    ),
    false,
  );
  assert.equal(
    continuation.nextActions[0]?.title,
    "Build effective graph state projection",
  );
  assert.equal(
    bootstrap.payload.context.openTasks[0],
    "Graph-driven runtime intelligence",
  );

  console.log("Project Continuation Bootstrap tests passed.");
} finally {
  fixture.dispose();
}
