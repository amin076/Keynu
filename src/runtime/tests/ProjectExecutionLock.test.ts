import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { withProjectExecutionLock } from '../storage/ProjectExecutionLock.js';
import { executeCommand } from '../CommandExecutor.js';
import { routeKapJob } from '../kap-job-router.js';
const root = await mkdtemp(join(tmpdir(), 'keynu-lock-'));
try {
  await mkdir(join(root, '.git')); await mkdir(join(root, 'nested'));
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const owner = withProjectExecutionLock(root, async () => { entered(); await gate; });
  await started;
  let routed = false;
  const job = routeKapJob({ protocol: 'KAP', version: '1.0', type: 'JOB', id: 'browser-fixture',
    payload: { target: 'filesystem', cwd: join(root, 'nested'), request: { action: 'writeFile', path: 'result', content: 'done' } } }).then(() => { routed = true; });
  await delay(80); assert.equal(routed, false, 'Browser filesystem job must wait for API owner on same Git checkout');
  release(); await Promise.all([owner, job]);
  assert.equal(await readFile(join(root, 'nested', 'result'), 'utf8'), 'done');
  const moduleUrl = pathToFileURL(join(process.cwd(), 'dist/runtime/storage/ProjectExecutionLock.js')).href;
  const script = join(root, 'child.mjs');
  await writeFile(script, `import {withProjectExecutionLock} from ${JSON.stringify(moduleUrl)}; await withProjectExecutionLock(process.cwd(), async()=>console.log('child-owned'));`);
  await withProjectExecutionLock(root, async () => {
    const result = await executeCommand({ command: process.execPath, args: [script], timeoutMs: 3000 }, root);
    assert.equal(result.ok, true, result.error); assert.match(result.stdout, /child-owned/);
  });
  // An inherited context cannot bypass a lock after its owner file has gone.
  const previous = process.env.KEYNU_PROJECT_LOCK_CONTEXT;
  process.env.KEYNU_PROJECT_LOCK_CONTEXT = JSON.stringify([[root, 'stale-token']]);
  try { await withProjectExecutionLock(root, async () => assert.ok(await readFile(join(root, '.keynu/state/mission-execution.lock/owner'), 'utf8'))); }
  finally { if (previous === undefined) delete process.env.KEYNU_PROJECT_LOCK_CONTEXT; else process.env.KEYNU_PROJECT_LOCK_CONTEXT = previous; }
  console.log('Project ownership: browser/API serialization, Git subdirectory identity and child reentrancy passed.');
} finally { await rm(root, { recursive: true, force: true }); }
