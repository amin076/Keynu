import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserContinuationCoordinator } from '../BrowserContinuationCoordinator.js';
import { ContinuationDeliveryService } from '../ContinuationDeliveryService.js';
import { ContinuationDeliveryStore } from '../ContinuationDeliveryStore.js';
import { ContinuationStore } from '../ContinuationStore.js';

const root = mkdtempSync(join(tmpdir(), 'keynu-continuation-budget-'));
const continuationRoot = join(root, 'continuations');
const deliveryRoot = join(root, 'deliveries');

function createCoordinator(): BrowserContinuationCoordinator {
  return new BrowserContinuationCoordinator({
    continuationStore: new ContinuationStore({ rootDir: continuationRoot }),
    deliveryService: new ContinuationDeliveryService(
      new ContinuationDeliveryStore({ rootDir: deliveryRoot }),
    ),
    activeMissionResolver: {
      resolve: () => ({
        projectId: 'keynu',
        missionId: 'mission-restart-budget',
        missionTitle: 'Restart Budget',
        currentMilestone: 'Verify persisted continuation budget',
        action: 'NONE',
        reasons: ['CONFIG_AND_STATE_MATCH'],
        stateMismatch: false,
        requiresBootstrap: false,
        diagnostics: [],
      }),
    } as any,
    missionStateStore: {
      getMission: () => ({ status: 'ACTIVE' }),
    } as any,
  });
}

try {
  const firstMessages: string[] = [];
  const first = await createCoordinator().continueAfterReport(
    {
      missionId: 'mission-restart-budget',
      jobId: 'job-budget-004',
      reportStatus: 'COMPLETED',
      autonomousStepCount: 3,
      maxAutonomousSteps: 12,
    },
    async (message) => {
      firstMessages.push(message);
    },
  );

  assert.equal(first.deliveryStatus, 'DELIVERED');
  assert.equal(firstMessages.length, 1);
  assert.match(firstMessages[0], /Autonomous Step: 4\/12/);

  const afterFirst = new ContinuationStore({ rootDir: continuationRoot }).read(
    'mission-restart-budget',
  );
  assert.ok(afterFirst);
  assert.equal(afterFirst.autonomousStepCount, 4);

  // Simulate a fresh BrowserAgent process: no counter is supplied by the caller.
  const secondMessages: string[] = [];
  const second = await createCoordinator().continueAfterReport(
    {
      missionId: 'mission-restart-budget',
      jobId: 'job-budget-005',
      reportStatus: 'COMPLETED',
      maxAutonomousSteps: 12,
    },
    async (message) => {
      secondMessages.push(message);
    },
  );

  assert.equal(second.deliveryStatus, 'DELIVERED');
  assert.equal(secondMessages.length, 1);
  assert.match(secondMessages[0], /Autonomous Step: 5\/12/);

  const afterSecond = new ContinuationStore({ rootDir: continuationRoot }).read(
    'mission-restart-budget',
  );
  assert.ok(afterSecond);
  assert.equal(afterSecond.autonomousStepCount, 5);

  // Replaying the same report must not consume another autonomous step.
  const replayMessages: string[] = [];
  const replay = await createCoordinator().continueAfterReport(
    {
      missionId: 'mission-restart-budget',
      jobId: 'job-budget-005',
      reportStatus: 'COMPLETED',
      maxAutonomousSteps: 12,
    },
    async (message) => {
      replayMessages.push(message);
    },
  );

  assert.equal(replay.deliveryStatus, 'SKIPPED_DUPLICATE');
  assert.equal(replayMessages.length, 0);
  const afterReplay = new ContinuationStore({ rootDir: continuationRoot }).read(
    'mission-restart-budget',
  );
  assert.ok(afterReplay);
  assert.equal(afterReplay.autonomousStepCount, 5);

  console.log('ContinuationBudgetRestartSafety.test passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
