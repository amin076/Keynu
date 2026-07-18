import type {
  ActiveMissionResolution,
  ActiveMissionResolutionAction,
} from "../mission/ActiveMissionResolver.js";

export type MissionBootstrapSession = {
  conversationUrl?: string;
  memoryRestored: boolean;
  missionProjectId?: string;
  missionId?: string;
  missionBootstrapId?: string;
  missionMemoryRevision?: string;
  missionRestorationStaleReason?: string;
  missionBootstrapSentAt?: string;
  missionBootstrapConversationUrl?: string;
};

export type MissionBootstrapDecision = {
  isSameConversation: boolean;
  bootstrapPending: boolean;
  shouldRestoreMission: boolean;
  reason:
    | "NEW_CONVERSATION"
    | "SESSION_NOT_RESTORED"
    | "BOOTSTRAP_PENDING"
    | "MISSION_RECONCILIATION_REQUIRED"
    | "SESSION_MISSION_UNKNOWN"
    | "SESSION_MISSION_MISMATCH"
    | "SESSION_MEMORY_REVISION_MISMATCH"
    | "ALREADY_RESTORED";
};

export type MissionBootstrapDecisionInput = {
  session: MissionBootstrapSession;
  conversationUrl: string;
  resolution: Pick<
    ActiveMissionResolution,
    | "projectId"
    | "missionId"
    | "action"
    | "stateMismatch"
    | "requiresBootstrap"
  > & {
    currentMemoryRevision?: string;
  };
  nowMs?: number;
  pendingWindowMs?: number;
};

function requiresMissionReconciliation(action: ActiveMissionResolutionAction): boolean {
  return action === "RECONCILE_STATE" || action === "REQUIRE_BOOTSTRAP";
}

function sessionMatchesResolution(
  session: MissionBootstrapSession,
  resolution: MissionBootstrapDecisionInput["resolution"],
): boolean {
  return (
    session.missionProjectId === resolution.projectId &&
    session.missionId === resolution.missionId
  );
}

function sessionMemoryRevisionMatchesResolution(
  session: MissionBootstrapSession,
  resolution: MissionBootstrapDecisionInput["resolution"],
): boolean {
  return (
    !resolution.currentMemoryRevision ||
    session.missionMemoryRevision === resolution.currentMemoryRevision
  );
}

function decideLegacyMissionBootstrap(
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
    reason: !isSameConversation
      ? "NEW_CONVERSATION"
      : bootstrapPending
        ? "BOOTSTRAP_PENDING"
        : session.memoryRestored
          ? "ALREADY_RESTORED"
          : "SESSION_NOT_RESTORED",
  };
}

export function decideMissionBootstrap(
  input: MissionBootstrapDecisionInput,
): MissionBootstrapDecision;
export function decideMissionBootstrap(
  session: MissionBootstrapSession,
  conversationUrl: string,
  nowMs?: number,
  pendingWindowMs?: number,
): MissionBootstrapDecision;
export function decideMissionBootstrap(
  inputOrSession: MissionBootstrapDecisionInput | MissionBootstrapSession,
  conversationUrl?: string,
  nowMs?: number,
  pendingWindowMs?: number,
): MissionBootstrapDecision {
  if ("session" in inputOrSession) {
    return decideMissionBootstrapWithResolution(inputOrSession);
  }

  if (!conversationUrl) {
    throw new Error("conversationUrl is required.");
  }

  return decideLegacyMissionBootstrap(
    inputOrSession,
    conversationUrl,
    nowMs,
    pendingWindowMs,
  );
}

function decideMissionBootstrapWithResolution(
  input: MissionBootstrapDecisionInput,
): MissionBootstrapDecision {
  const nowMs = input.nowMs ?? Date.now();
  const pendingWindowMs = input.pendingWindowMs ?? 5 * 60 * 1000;
  const { session, conversationUrl, resolution } = input;
  const isSameConversation = session.conversationUrl === conversationUrl;
  const sentAtMs = session.missionBootstrapSentAt
    ? Date.parse(session.missionBootstrapSentAt)
    : Number.NaN;
  const bootstrapAgeMs = Number.isFinite(sentAtMs)
    ? nowMs - sentAtMs
    : Number.POSITIVE_INFINITY;
  const hasSessionMissionIdentity = Boolean(
    session.missionProjectId && session.missionId,
  );
  const missionMatches =
    hasSessionMissionIdentity &&
    sessionMatchesResolution(session, resolution);
  const memoryRevisionMatches = sessionMemoryRevisionMatchesResolution(
    session,
    resolution,
  );
  const bootstrapPending =
    isSameConversation &&
    !session.memoryRestored &&
    missionMatches &&
    memoryRevisionMatches &&
    session.missionBootstrapConversationUrl === conversationUrl &&
    bootstrapAgeMs >= 0 &&
    bootstrapAgeMs < pendingWindowMs;

  if (bootstrapPending) {
    return {
      isSameConversation,
      bootstrapPending: true,
      shouldRestoreMission: false,
      reason: "BOOTSTRAP_PENDING",
    };
  }

  if (!isSameConversation) {
    return {
      isSameConversation,
      bootstrapPending: false,
      shouldRestoreMission: true,
      reason: "NEW_CONVERSATION",
    };
  }

  if (
    resolution.stateMismatch ||
    resolution.requiresBootstrap ||
    requiresMissionReconciliation(resolution.action)
  ) {
    return {
      isSameConversation,
      bootstrapPending: false,
      shouldRestoreMission: true,
      reason: "MISSION_RECONCILIATION_REQUIRED",
    };
  }

  if (!hasSessionMissionIdentity) {
    return {
      isSameConversation,
      bootstrapPending: false,
      shouldRestoreMission: true,
      reason: "SESSION_MISSION_UNKNOWN",
    };
  }

  if (!missionMatches) {
    return {
      isSameConversation,
      bootstrapPending: false,
      shouldRestoreMission: true,
      reason: "SESSION_MISSION_MISMATCH",
    };
  }

  if (!memoryRevisionMatches) {
    return {
      isSameConversation,
      bootstrapPending: false,
      shouldRestoreMission: true,
      reason: "SESSION_MEMORY_REVISION_MISMATCH",
    };
  }

  if (!session.memoryRestored) {
    return {
      isSameConversation,
      bootstrapPending: false,
      shouldRestoreMission: true,
      reason: "SESSION_NOT_RESTORED",
    };
  }

  return {
    isSameConversation,
    bootstrapPending: false,
    shouldRestoreMission: false,
    reason: "ALREADY_RESTORED",
  };
}
