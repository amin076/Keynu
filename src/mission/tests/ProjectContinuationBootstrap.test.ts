import { strict as assert } from "node:assert";
import { createIsolatedMissionManager } from "./createIsolatedMissionManager.js";

const fixture = createIsolatedMissionManager();

try {
  const bootstrap = fixture.manager.prepare();
  const continuation = bootstrap.payload.context.continuation;

  assert.equal(bootstrap.payload.missionId, "runtime-readiness-melakat");
  assert.equal(
    continuation.currentMilestone,
    "Complete runtime cleanup and establish the Melakat domain integration on the shared Engineering Runtime",
  );
  assert.deepEqual(
    continuation.pendingMilestones,
    [
      "Reconcile workflow continuation with the persistent mission continuation path",
      "Remove only verified generated, backup, and historical runtime garbage without breaking compatibility contracts",
      "Reconcile architecture and status documentation with the current runtime",
      "Add Melakat as a Keynu project and implement a domain-specific MelakatDriver on top of Engineering Runtime",
      "Create resumable Melakat development and research mission templates",
      "Prove an end-to-end restart/resume Melakat mission with verified local actions and experiment evidence",
    ],
  );
  assert(continuation.architectureDecisions.length >= 4);
  assert.equal(
    continuation.recommendedReading[0]?.path,
    "docs/AUDIT/KEYNU_RUNTIME_AUDIT_2026-09-06.md",
  );
  assert.equal(
    continuation.knownLimitations.some((item) =>
      item.includes("MelakatDriver") && item.includes("not yet implemented"),
    ),
    true,
  );
  assert.equal(
    continuation.nextActions[0]?.title,
    "Reconcile workflow and mission continuation",
  );
  assert.equal(
    bootstrap.payload.context.openTasks[0],
    "Reconcile workflow continuation with the persistent mission continuation path",
  );

  console.log("Project Continuation Bootstrap tests passed.");
} finally {
  fixture.dispose();
}
