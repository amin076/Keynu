import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PersistentJobStore } from '../PersistentJobStore.js';

const root = mkdtempSync(join(tmpdir(), 'keynu-job-store-'));

try {
  const firstProcess = new PersistentJobStore(root);
  const claimed = await firstProcess.claim('job-restart-safe-001');
  assert.equal(claimed.created, true);
  assert.equal(claimed.record.state, 'RECEIVED');

  await firstProcess.set('job-restart-safe-001', 'RUNNING');
  const reportText = '```kap\n{"type":"REPORT","id":"report-job-restart-safe-001"}\n```';
  await firstProcess.recordReport(
    'job-restart-safe-001',
    'COMPLETED',
    reportText,
    'report-job-restart-safe-001',
  );

  const secondProcess = new PersistentJobStore(root);
  const afterRestart = await secondProcess.claim('job-restart-safe-001');
  assert.equal(afterRestart.created, false);
  assert.equal(afterRestart.record.state, 'COMPLETED');
  assert.equal(afterRestart.record.reportText, reportText);
  assert.equal(afterRestart.record.reportDeliveredAt, undefined);

  await secondProcess.markReportDelivered('job-restart-safe-001');

  const thirdProcess = new PersistentJobStore(root);
  const delivered = await thirdProcess.get('job-restart-safe-001');
  assert.ok(delivered);
  assert.equal(delivered.state, 'COMPLETED');
  assert.equal(delivered.reportText, reportText);
  assert.ok(delivered.reportDeliveredAt);

  const duplicate = await thirdProcess.claim('job-restart-safe-001');
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.record.reportId, 'report-job-restart-safe-001');

  console.log('PersistentJobStoreRestartSafety.test passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
