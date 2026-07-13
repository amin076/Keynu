import { strict as assert } from "node:assert";
import { MissionManager } from "../MissionManager.js";

const bootstrap = new MissionManager().prepare();
const continuation = bootstrap.payload.context.continuation;

assert.equal(
  continuation.currentMilestone,
  "Clean New-Chat Recovery Verification",
);
assert(continuation.pendingMilestones.includes("Full new-chat recovery test"));
assert(continuation.architectureDecisions.length >= 4);
assert.equal(continuation.recommendedReading[0]?.path, "docs/KAP/KAP_PROTOCOL_V1.md");
assert(continuation.knownLimitations.some((item) => item.includes("type payload")));
assert.equal(continuation.nextActions[0]?.title, "Run a clean new-chat recovery test");
assert.equal(bootstrap.payload.context.openTasks[0], "Full new-chat recovery test");

console.log("Project Continuation Bootstrap tests passed.");
