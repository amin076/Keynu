import { strict as assert } from "node:assert";
import { decideMissionBootstrap } from "../MissionBootstrapPolicy.js";

const now = Date.parse("2026-07-13T07:20:00.000Z");
const url = "https://chatgpt.com/c/test";

assert.deepEqual(
  decideMissionBootstrap(
    { conversationUrl: url, memoryRestored: true },
    url,
    now,
  ),
  {
    isSameConversation: true,
    bootstrapPending: false,
    shouldRestoreMission: false,
  },
);

assert.equal(
  decideMissionBootstrap(
    {
      conversationUrl: url,
      memoryRestored: false,
      missionBootstrapConversationUrl: url,
      missionBootstrapSentAt: "2026-07-13T07:19:00.000Z",
    },
    url,
    now,
  ).bootstrapPending,
  true,
);

assert.equal(
  decideMissionBootstrap(
    {
      conversationUrl: url,
      memoryRestored: false,
      missionBootstrapConversationUrl: url,
      missionBootstrapSentAt: "2026-07-13T07:10:00.000Z",
    },
    url,
    now,
  ).shouldRestoreMission,
  true,
);

assert.equal(
  decideMissionBootstrap(
    { conversationUrl: "old", memoryRestored: true },
    url,
    now,
  ).shouldRestoreMission,
  true,
);

console.log("MissionBootstrapPolicy tests passed.");
