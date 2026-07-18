export const MISSION_STATES = [
  'NEW',
  'PLANNING',
  'RUNNING',
  'WAITING_REPORT',
  'EVALUATING',
  'LOCAL_CONTINUE',
  'WAITING_AI',
  'WAITING_USER',
  'WAITING_EXTERNAL_SYSTEM',
  'RECOVERING',
  'BLOCKED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type MissionState = (typeof MISSION_STATES)[number];

const ALLOWED_TRANSITIONS: Record<MissionState, readonly MissionState[]> = {
  NEW: ['PLANNING', 'CANCELLED'],
  PLANNING: ['RUNNING', 'WAITING_AI', 'WAITING_USER', 'BLOCKED', 'FAILED'],
  RUNNING: ['WAITING_REPORT', 'RECOVERING', 'FAILED', 'CANCELLED'],
  WAITING_REPORT: ['EVALUATING', 'RECOVERING', 'FAILED', 'CANCELLED'],
  EVALUATING: [
    'LOCAL_CONTINUE',
    'WAITING_AI',
    'WAITING_USER',
    'WAITING_EXTERNAL_SYSTEM',
    'RECOVERING',
    'BLOCKED',
    'COMPLETED',
    'FAILED',
  ],
  LOCAL_CONTINUE: ['RUNNING', 'EVALUATING', 'BLOCKED', 'FAILED'],
  WAITING_AI: ['PLANNING', 'RUNNING', 'WAITING_USER', 'BLOCKED', 'FAILED'],
  WAITING_USER: ['PLANNING', 'RUNNING', 'CANCELLED', 'FAILED'],
  WAITING_EXTERNAL_SYSTEM: ['RUNNING', 'RECOVERING', 'BLOCKED', 'FAILED'],
  RECOVERING: ['RUNNING', 'WAITING_AI', 'WAITING_USER', 'BLOCKED', 'FAILED'],
  BLOCKED: ['PLANNING', 'RECOVERING', 'CANCELLED', 'FAILED'],
  COMPLETED: [],
  FAILED: ['RECOVERING', 'CANCELLED'],
  CANCELLED: [],
};

export function canTransitionMission(
  from: MissionState,
  to: MissionState,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertMissionTransition(
  from: MissionState,
  to: MissionState,
): void {
  if (!canTransitionMission(from, to)) {
    throw new Error(`Invalid mission transition: ${from} -> ${to}`);
  }
}
