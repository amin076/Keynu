import { strict as assert } from 'node:assert';
import { validateContinuationContract } from '../ContinuationTypes.js';
import {
  assertMissionTransition,
  canTransitionMission,
} from '../MissionStateMachine.js';

const contract = validateContinuationContract({
  decision: 'CONTINUE',
  reason: 'The next implementation step is known.',
  nextAction: 'generate_job',
  owner: 'ai',
  missionComplete: false,
});

assert.equal(contract.decision, 'CONTINUE');
assert.equal(contract.owner, 'ai');
assert.equal(canTransitionMission('EVALUATING', 'WAITING_AI'), true);
assert.equal(canTransitionMission('COMPLETED', 'RUNNING'), false);
assert.doesNotThrow(() => assertMissionTransition('NEW', 'PLANNING'));
assert.throws(
  () => assertMissionTransition('COMPLETED', 'RUNNING'),
  /Invalid mission transition/,
);

assert.throws(
  () =>
    validateContinuationContract({
      decision: 'CONTINUE',
      reason: '',
      nextAction: 'generate_job',
      owner: 'ai',
      missionComplete: false,
    }),
  /reason/,
);

console.log('ContinuationContract.test passed');
