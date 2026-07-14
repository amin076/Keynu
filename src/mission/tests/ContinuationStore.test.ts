import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContinuationStore } from '../ContinuationStore.js';

const temporaryRoot = mkdtempSync(join(tmpdir(), 'keynu-continuation-store-'));

try {
  const store = new ContinuationStore({ rootDir: temporaryRoot });

  const first = store.record(
    'mission-test-001',
    'WAITING_AI',
    {
      decision: 'WAITING_AI',
      reason: 'The runtime report requires the next AI decision.',
      nextAction: 'request_next_kap_job',
      owner: 'ai',
      missionComplete: false,
      retryable: true,
      resumeToken: 'resume-test-001',
    },
    {
      jobId: 'job-test-001',
      autonomousStepCount: 3,
      consecutiveFailureCount: 0,
    },
  );

  assert.equal(first.missionId, 'mission-test-001');
  assert.equal(first.continuation.owner, 'ai');
  assert.equal(first.autonomousStepCount, 3);

  const restored = store.read('mission-test-001');
  assert.ok(restored);
  assert.equal(restored.jobId, 'job-test-001');
  assert.equal(restored.continuation.resumeToken, 'resume-test-001');

  const patched = store.patch('mission-test-001', {
    missionState: 'RUNNING',
    continuation: {
      decision: 'CONTINUE',
      reason: 'A new KAP job has been received.',
      nextAction: 'execute_job',
      owner: 'runtime',
      missionComplete: false,
    },
    autonomousStepCount: 4,
  });

  assert.equal(patched.missionState, 'RUNNING');
  assert.equal(patched.autonomousStepCount, 4);
  assert.equal(patched.continuation.owner, 'runtime');

  const raw = JSON.parse(
    readFileSync(store.getFilePath('mission-test-001'), 'utf8'),
  );
  assert.equal(raw.schemaVersion, 'keynu-continuation-state.v1');

  assert.throws(
    () => store.getFilePath('../unsafe'),
    /unsupported characters/,
  );

  assert.throws(
    () => store.patch('missing-mission', { autonomousStepCount: 1 }),
    /does not exist/,
  );

  console.log('ContinuationStore.test passed');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
