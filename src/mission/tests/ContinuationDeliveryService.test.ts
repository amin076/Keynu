import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContinuationDeliveryService } from '../ContinuationDeliveryService.js';
import { ContinuationDeliveryStore } from '../ContinuationDeliveryStore.js';

const rootDir = mkdtempSync(join(tmpdir(), 'keynu-continuation-delivery-'));

try {
  const store = new ContinuationDeliveryStore({ rootDir });
  const service = new ContinuationDeliveryService(store);
  const messages: string[] = [];

  const context = {
    missionId: 'mission-delivery-test',
    missionTitle: 'Delivery Test',
    jobId: 'job-delivery-test-001',
    autonomousStepCount: 1,
    maxAutonomousSteps: 8,
    continuation: {
      decision: 'WAITING_AI' as const,
      reason: 'The verified job completed and another step is available.',
      nextAction: 'generate_next_kap_job',
      owner: 'ai' as const,
      missionComplete: false,
      retryable: true,
    },
  };

  const first = await service.deliver(context, async (message) => {
    messages.push(message);
  });

  assert.equal(first.status, 'DELIVERED');
  assert.equal(messages.length, 1);
  assert.match(messages[0], /KEYNU_CONTINUATION_REQUEST/);

  const persisted = store.read(first.requestId);
  assert.ok(persisted);
  assert.equal(persisted.status, 'DELIVERED');
  assert.equal(persisted.attemptCount, 1);
  assert.ok(persisted.deliveredAt);

  const duplicate = await service.deliver(context, async (message) => {
    messages.push(message);
  });

  assert.equal(duplicate.status, 'SKIPPED_DUPLICATE');
  assert.equal(messages.length, 1);

  const userOwned = await service.deliver(
    {
      ...context,
      continuation: {
        ...context.continuation,
        decision: 'WAITING_USER' as const,
        owner: 'user' as const,
      },
    },
    async () => {
      throw new Error('must not send');
    },
  );

  assert.equal(userOwned.status, 'SKIPPED_POLICY');

  const failedContext = {
    ...context,
    jobId: 'job-delivery-test-002',
  };

  const failed = await service.deliver(failedContext, async () => {
    throw new Error('simulated delivery failure');
  });

  assert.equal(failed.status, 'FAILED');
  const failedRecord = store.read(failed.requestId);
  assert.ok(failedRecord);
  assert.equal(failedRecord.status, 'FAILED');
  assert.equal(failedRecord.attemptCount, 1);
  assert.match(failedRecord.lastError || '', /simulated delivery failure/);

  const retryMessages: string[] = [];
  const retry = await service.deliver(failedContext, async (message) => {
    retryMessages.push(message);
  });

  assert.equal(retry.status, 'DELIVERED');
  assert.equal(retryMessages.length, 1);
  assert.equal(store.read(retry.requestId)?.attemptCount, 2);

  assert.throws(
    () =>
      store.reserve({
        requestId: '../unsafe',
        missionId: 'mission-safe',
        resumeToken: 'token-safe',
      }),
    /unsafe characters/,
  );

  console.log('ContinuationDeliveryService.test passed');
} finally {
  rmSync(rootDir, { recursive: true, force: true });
}
