import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserContinuationCoordinator } from '../BrowserContinuationCoordinator.js';
import { ContinuationDeliveryService } from '../ContinuationDeliveryService.js';
import { ContinuationDeliveryStore } from '../ContinuationDeliveryStore.js';
import { ContinuationStore } from '../ContinuationStore.js';

const root = mkdtempSync(join(tmpdir(), 'keynu-browser-continuation-'));

try {
  const continuationStore = new ContinuationStore({
    rootDir: join(root, 'continuations'),
  });
  const deliveryStore = new ContinuationDeliveryStore({
    rootDir: join(root, 'deliveries'),
  });
  const coordinator = new BrowserContinuationCoordinator({
    continuationStore,
    deliveryService: new ContinuationDeliveryService(deliveryStore),
  });

  const messages: string[] = [];
  const completed = await coordinator.continueAfterReport(
    {
      missionId: 'mission-browser-continuation-test',
      missionTitle: 'Browser Continuation Test',
      jobId: 'job-browser-completed-001',
      reportStatus: 'COMPLETED',
      autonomousStepCount: 3,
      maxAutonomousSteps: 12,
    },
    async (message) => {
      messages.push(message);
    },
  );

  assert.equal(completed.decision, 'WAITING_AI');
  assert.equal(completed.deliveryStatus, 'DELIVERED');
  assert.equal(messages.length, 1);
  assert.match(messages[0], /KEYNU_CONTINUATION_REQUEST/);
  assert.match(messages[0], /Autonomous Step: 4\/12/);

  const storedCompleted = continuationStore.read(
    'mission-browser-continuation-test',
  );
  assert.ok(storedCompleted);
  assert.equal(storedCompleted.missionState, 'WAITING_AI');
  assert.equal(storedCompleted.consecutiveFailureCount, 0);

  const duplicate = await coordinator.continueAfterReport(
    {
      missionId: 'mission-browser-continuation-test',
      missionTitle: 'Browser Continuation Test',
      jobId: 'job-browser-completed-001',
      reportStatus: 'COMPLETED',
      autonomousStepCount: 3,
      maxAutonomousSteps: 12,
    },
    async (message) => {
      messages.push(message);
    },
  );

  assert.equal(duplicate.deliveryStatus, 'SKIPPED_DUPLICATE');
  assert.equal(messages.length, 1);

  const failureMessages: string[] = [];
  const failed = await coordinator.continueAfterReport(
    {
      missionId: 'mission-browser-failure-test',
      jobId: 'job-browser-failed-001',
      reportStatus: 'FAILED',
      autonomousStepCount: 1,
      consecutiveFailureCount: 2,
    },
    async (message) => {
      failureMessages.push(message);
    },
  );

  assert.equal(failed.deliveryStatus, 'DELIVERED');
  assert.equal(failureMessages.length, 1);
  assert.match(failureMessages[0], /recovery decision/i);

  const storedFailed = continuationStore.read(
    'mission-browser-failure-test',
  );
  assert.ok(storedFailed);
  assert.equal(storedFailed.consecutiveFailureCount, 3);

  console.log('BrowserContinuationCoordinator.test passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
