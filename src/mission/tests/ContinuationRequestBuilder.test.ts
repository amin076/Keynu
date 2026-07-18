import { strict as assert } from 'node:assert';
import {
  buildContinuationRequest,
  createContinuationResumeToken,
} from '../ContinuationRequestBuilder.js';

const context = {
  missionId: 'mission-continuation-test',
  missionTitle: 'Continuation Test',
  jobId: 'job-test-001',
  autonomousStepCount: 2,
  maxAutonomousSteps: 8,
  continuation: {
    decision: 'WAITING_AI' as const,
    reason: 'The previous job completed successfully.',
    nextAction: 'generate_next_kap_job',
    owner: 'ai' as const,
    missionComplete: false,
    retryable: true,
  },
};

const first = buildContinuationRequest(context);
const second = buildContinuationRequest(context);

assert.equal(first.shouldSend, true);
assert.equal(first.requestId, second.requestId);
assert.equal(first.resumeToken, second.resumeToken);
assert.match(first.message, /KEYNU_CONTINUATION_REQUEST/);
assert.match(first.message, /valid KAP JOB/);
assert.match(first.message, /Autonomous Step: 3\/8/);
assert.equal(
  first.resumeToken,
  createContinuationResumeToken(
    context.missionId,
    context.jobId,
    context.continuation.nextAction,
  ),
);

const completed = buildContinuationRequest({
  ...context,
  continuation: {
    ...context.continuation,
    decision: 'COMPLETED' as const,
    owner: 'none' as const,
    missionComplete: true,
  },
});
assert.equal(completed.shouldSend, false);

const limited = buildContinuationRequest({
  ...context,
  autonomousStepCount: 8,
});
assert.equal(limited.shouldSend, false);

console.log('ContinuationRequestBuilder.test passed');
