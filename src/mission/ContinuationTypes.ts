export const CONTINUATION_DECISIONS = [
  'CONTINUE',
  'LOCAL_CONTINUE',
  'WAITING_RUNTIME',
  'WAITING_AI',
  'WAITING_USER',
  'WAITING_EXTERNAL_SYSTEM',
  'RECOVERING',
  'BLOCKED',
  'COMPLETED',
  'FAILED',
] as const;

export type ContinuationDecision =
  (typeof CONTINUATION_DECISIONS)[number];

export const CONTINUATION_OWNERS = [
  'runtime',
  'browser_agent',
  'mission_engine',
  'ai',
  'user',
  'external_system',
  'none',
] as const;

export type ContinuationOwner =
  (typeof CONTINUATION_OWNERS)[number];

export type ContinuationContract = {
  decision: ContinuationDecision;
  reason: string;
  nextAction: string;
  owner: ContinuationOwner;
  missionComplete: boolean;
  retryable?: boolean;
  resumeToken?: string;
  metadata?: Record<string, unknown>;
};

export function isContinuationDecision(
  value: unknown,
): value is ContinuationDecision {
  return (
    typeof value === 'string' &&
    CONTINUATION_DECISIONS.includes(value as ContinuationDecision)
  );
}

export function validateContinuationContract(
  value: unknown,
): ContinuationContract {
  if (!value || typeof value !== 'object') {
    throw new Error('Continuation contract must be an object.');
  }

  const candidate = value as Partial<ContinuationContract>;

  if (!isContinuationDecision(candidate.decision)) {
    throw new Error('Continuation contract has an invalid decision.');
  }

  if (typeof candidate.reason !== 'string' || !candidate.reason.trim()) {
    throw new Error('Continuation contract requires a reason.');
  }

  if (
    typeof candidate.nextAction !== 'string' ||
    !candidate.nextAction.trim()
  ) {
    throw new Error('Continuation contract requires a next action.');
  }

  if (
    typeof candidate.owner !== 'string' ||
    !CONTINUATION_OWNERS.includes(candidate.owner as ContinuationOwner)
  ) {
    throw new Error('Continuation contract has an invalid owner.');
  }

  if (typeof candidate.missionComplete !== 'boolean') {
    throw new Error('Continuation contract requires missionComplete.');
  }

  return candidate as ContinuationContract;
}
