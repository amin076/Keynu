export type MissionBootstrapSession = {
  conversationUrl?: string;
  memoryRestored: boolean;
  missionBootstrapSentAt?: string;
  missionBootstrapConversationUrl?: string;
};

export type MissionBootstrapDecision = {
  isSameConversation: boolean;
  bootstrapPending: boolean;
  shouldRestoreMission: boolean;
};

export function decideMissionBootstrap(
  session: MissionBootstrapSession,
  conversationUrl: string,
  nowMs = Date.now(),
  pendingWindowMs = 5 * 60 * 1000,
): MissionBootstrapDecision {
  const isSameConversation = session.conversationUrl === conversationUrl;
  const sentAtMs = session.missionBootstrapSentAt
    ? Date.parse(session.missionBootstrapSentAt)
    : Number.NaN;
  const bootstrapAgeMs = Number.isFinite(sentAtMs)
    ? nowMs - sentAtMs
    : Number.POSITIVE_INFINITY;
  const bootstrapPending =
    isSameConversation &&
    !session.memoryRestored &&
    session.missionBootstrapConversationUrl === conversationUrl &&
    bootstrapAgeMs >= 0 &&
    bootstrapAgeMs < pendingWindowMs;

  return {
    isSameConversation,
    bootstrapPending,
    shouldRestoreMission:
      !isSameConversation || (!session.memoryRestored && !bootstrapPending),
  };
}
