import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PersistentJobStore } from '../PersistentJobStore.js';
import { executeCommand } from '../CommandExecutor.js';
import { ProviderRuntime } from '../ProviderRuntime.js';
import { RuntimeDispatcher } from '../RuntimeDispatcher.js';
import { createProviderResponse } from '../../providers/api/ProviderResponse.js';

const root = await mkdtemp(join(tmpdir(), 'keynu-audit-'));
try {
  const stores = Array.from({ length: 20 }, () => new PersistentJobStore(root));
  const claims = await Promise.all(stores.map(store => store.claim('one-job')));
  assert.equal(claims.filter(result => result.created).length, 1);
  await Promise.all(stores.map((store, i) => store.claim(`distinct-${i}`)));
  for (let i = 0; i < stores.length; i++) assert.ok(await stores[0]!.get(`distinct-${i}`));
  await stores[0]!.recordReport('one-job', 'COMPLETED', 'report');
  await Promise.all(stores.map(store => store.markReportDeliveryAttempt('one-job')));
  assert.equal((await stores[0]!.get('one-job'))?.reportDeliveryAttempts, 20);
  const command = await executeCommand({ command: 'script', runtime: 'node', script: 'process.exit(7)', expectedExitCodes: [7] }, root);
  assert.equal(command.ok, true); assert.equal(command.exitCode, 7);
  for (const statuses of [['FAILED'], ['FAILED', 'COMPLETED'], ['SKIPPED']] as const) {
    let index = 0;
    const runtime = new ProviderRuntime({ runtimeDispatcher: new RuntimeDispatcher({ handlers: {
      JOB: envelope => ({ action: 'JOB', envelope, status: statuses[index++]! }),
    } }) });
    const content = statuses.map((_, i) => '```kap\n' + JSON.stringify({ protocol: 'KAP', version: '1.0', type: 'JOB', id: `j-${i}`, payload: { target: 'noop' } }) + '\n```').join('\n');
    const result = await runtime.execute(createProviderResponse({ requestId: 'test', providerId: 'test', content }));
    assert.equal(result.status, statuses.length === 2 ? 'PARTIAL' : statuses[0]);
  }
  console.log('Audit regressions: atomic claims, concurrent updates, script exit codes, aggregate failure status passed.');
} finally { await rm(root, { recursive: true, force: true }); }
