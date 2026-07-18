import { strict as assert } from "node:assert";
import { decideMissionBootstrap } from "../MissionBootstrapPolicy.js";

const now = Date.parse("2026-07-13T07:20:00.000Z");
const url = "https://chatgpt.com/c/test";
const resolvedBuildWeekMission = {
  projectId: "keynu",
  missionId: "openai-build-week",
  action: "NONE" as const,
  stateMismatch: false,
  requiresBootstrap: false,
};

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
    reason: "ALREADY_RESTORED",
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

assert.deepEqual(
  decideMissionBootstrap({
    session: {
      conversationUrl: url,
      memoryRestored: true,
      missionProjectId: "keynu",
      missionId: "openai-build-week",
    },
    conversationUrl: url,
    resolution: resolvedBuildWeekMission,
    nowMs: now,
  }),
  {
    isSameConversation: true,
    bootstrapPending: false,
    shouldRestoreMission: false,
    reason: "ALREADY_RESTORED",
  },
);

assert.deepEqual(
  decideMissionBootstrap({
    session: {
      conversationUrl: url,
      memoryRestored: true,
    },
    conversationUrl: url,
    resolution: resolvedBuildWeekMission,
    nowMs: now,
  }),
  {
    isSameConversation: true,
    bootstrapPending: false,
    shouldRestoreMission: true,
    reason: "SESSION_MISSION_UNKNOWN",
  },
);

assert.deepEqual(
  decideMissionBootstrap({
    session: {
      conversationUrl: url,
      memoryRestored: true,
      missionProjectId: "keynu",
      missionId: "react-mission-control-dashboard",
    },
    conversationUrl: url,
    resolution: resolvedBuildWeekMission,
    nowMs: now,
  }),
  {
    isSameConversation: true,
    bootstrapPending: false,
    shouldRestoreMission: true,
    reason: "SESSION_MISSION_MISMATCH",
  },
);

assert.deepEqual(
  decideMissionBootstrap({
    session: {
      conversationUrl: url,
      memoryRestored: true,
      missionProjectId: "keynu",
      missionId: "react-mission-control-dashboard",
    },
    conversationUrl: url,
    resolution: {
      ...resolvedBuildWeekMission,
      action: "REQUIRE_BOOTSTRAP",
      stateMismatch: true,
      requiresBootstrap: true,
    },
    nowMs: now,
  }),
  {
    isSameConversation: true,
    bootstrapPending: false,
    shouldRestoreMission: true,
    reason: "MISSION_RECONCILIATION_REQUIRED",
  },
);

assert.deepEqual(
  decideMissionBootstrap({
    session: {
      conversationUrl: url,
      memoryRestored: false,
      missionProjectId: "keynu",
      missionId: "openai-build-week",
      missionBootstrapConversationUrl: url,
      missionBootstrapSentAt: "2026-07-13T07:19:00.000Z",
    },
    conversationUrl: url,
    resolution: resolvedBuildWeekMission,
    nowMs: now,
  }),
  {
    isSameConversation: true,
    bootstrapPending: true,
    shouldRestoreMission: false,
    reason: "BOOTSTRAP_PENDING",
  },
);

assert.deepEqual(
  decideMissionBootstrap({
    session: {
      conversationUrl: url,
      memoryRestored: false,
      missionProjectId: "keynu",
      missionId: "react-mission-control-dashboard",
      missionBootstrapConversationUrl: url,
      missionBootstrapSentAt: "2026-07-13T07:19:00.000Z",
    },
    conversationUrl: url,
    resolution: resolvedBuildWeekMission,
    nowMs: now,
  }),
  {
    isSameConversation: true,
    bootstrapPending: false,
    shouldRestoreMission: true,
    reason: "SESSION_MISSION_MISMATCH",
  },
);

console.log("MissionBootstrapPolicy tests passed.");
