import { strict as assert } from "node:assert";
import { MissionManager } from "../MissionManager.js";

const bootstrap = new MissionManager().prepare();
const continuation = bootstrap.payload.context.continuation;

assert.equal(
  continuation.currentMilestone,
  "Project Continuation Bootstrap and KAP Type-Specific Validation",
);
assert(continuation.pendingMilestones.includes("Type-specific KAP message validation"));
assert(continuation.architectureDecisions.length >= 4);
assert.equal(continuation.recommendedReading[0]?.path, "docs/KAP/KAP_PROTOCOL_V1.md");
assert(continuation.knownLimitations.some((item) => item.includes("type payload")));
assert.equal(continuation.nextActions[0]?.title, "Verify Project Continuation Bootstrap output");
assert.equal(bootstrap.payload.context.openTasks[0], "Project Continuation Bootstrap");

console.log("Project Continuation Bootstrap tests passed.");
