import { createHash } from 'node:crypto';
import type { ContinuationContract } from './ContinuationTypes.js';

export type ContinuationRequestContext = {
  missionId: string;
  missionTitle?: string;
  jobId?: string;
  continuation: ContinuationContract;
  autonomousStepCount: number;
  maxAutonomousSteps: number;
};

export type ContinuationRequest = {
  requestId: string;
  resumeToken: string;
  message: string;
  shouldSend: boolean;
  reason: string;
};

export function createContinuationResumeToken(
  missionId: string,
  jobId: string | undefined,
  nextAction: string,
): string {
  return createHash('sha256')
    .update([missionId, jobId || 'no-job', nextAction].join('|'))
    .digest('hex')
    .slice(0, 24);
}

export function buildContinuationRequest(
  context: ContinuationRequestContext,
): ContinuationRequest {
  const missionId = context.missionId.trim();
  if (!missionId) throw new Error('missionId must not be empty.');

  const continuation = context.continuation;
  let shouldSend = true;
  let reason = 'The active mission requires the next AI continuation decision.';

  if (continuation.missionComplete) {
    shouldSend = false;
    reason = 'Mission is already complete.';
  } else if (continuation.owner !== 'ai') {
    shouldSend = false;
    reason = `Next action belongs to ${continuation.owner}, not the AI.`;
  } else if (
    continuation.decision !== 'WAITING_AI' &&
    continuation.decision !== 'CONTINUE'
  ) {
    shouldSend = false;
    reason = `Decision ${continuation.decision} does not request AI work.`;
  } else if (context.autonomousStepCount >= context.maxAutonomousSteps) {
    shouldSend = false;
    reason = 'Autonomous step limit has been reached.';
  }

  const resumeToken =
    continuation.resumeToken ||
    createContinuationResumeToken(
      missionId,
      context.jobId,
      continuation.nextAction,
    );

  const requestId = `continuation-${resumeToken}`;
  const lines = [
    'KEYNU_CONTINUATION_REQUEST',
    '',
    `Mission ID: ${missionId}`,
    context.missionTitle ? `Mission: ${context.missionTitle}` : '',
    context.jobId ? `Last Job ID: ${context.jobId}` : '',
    `Resume Token: ${resumeToken}`,
    `Reason: ${continuation.reason}`,
    `Required Next Action: ${continuation.nextAction}`,
    `Autonomous Step: ${context.autonomousStepCount + 1}/${context.maxAutonomousSteps}`,
    '',
    'Continue the active mission now.',
    'Return either the next valid KAP JOB or an explicit WAITING_USER, WAITING_EXTERNAL_SYSTEM, BLOCKED, COMPLETED, or FAILED declaration.',
    'Do not silently stop when a safe next KAP JOB can be issued.',
  ].filter(Boolean);

  return {
    requestId,
    resumeToken,
    message: lines.join('\n'),
    shouldSend,
    reason,
  };
}
