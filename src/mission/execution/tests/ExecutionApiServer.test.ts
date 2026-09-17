import { setTimeout as delay } from 'node:timers/promises';
import { strict as assert } from 'node:assert';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executionApiServer } from '../ExecutionApiServer.js';
import { ExecutionPlanStore } from '../ExecutionPlanStore.js';
import { MissionExecutionRunner } from '../MissionExecutionRunner.js';
import { createBuiltinFunctions } from '../../../engineering/functions/BuiltinFunctions.js';

const directory = await mkdtemp(join(tmpdir(), 'keynu-api-test-'));
const token = 'test-token-'.repeat(5);
const runner = new MissionExecutionRunner(new ExecutionPlanStore(join(directory, 'state')), createBuiltinFunctions(), {
  decide: async () => ({ kind: 'finish', summary: 'fixture', nextSteps: [] }),
  review: async () => ({ approved: true, reason: 'fixture verified', nextSteps: [] }),
});
const server = executionApiServer(runner, token, [{ root: directory, allowedFunctions: ['project.list'] }]);
server.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  assert.equal((await fetch(`${url}/plans`)).status, 401);
  assert.equal((await fetch(`${url}/plans`, { headers: { ...headers, origin: 'http://evil.test' } })).status, 401);
  const plan = { id: 'api-plan', projectId: 'fixture', projectRoot: directory, goal: 'Inspect fixture', steps: [
    { id: 'list', goal: 'List files', allowedFunctions: ['project.list'], verification: [{ name: 'project.list', args: {} }] },
  ] };
  const submit = (value: unknown) => fetch(`${url}/plans`, { method: 'POST', headers, body: JSON.stringify(value) });
  assert.equal((await submit({ ...plan, steps: [{ ...plan.steps[0], allowedFunctions: ['project.write', 'project.list'] }] })).status, 403);
  assert.equal((await submit(plan)).status, 201);
  assert.equal((await submit(plan)).status, 400);
  assert.equal((await fetch(`${url}/health`, { headers })).status, 200);
  assert.equal(Object.keys((await (await fetch(`${url}/plans`, { headers })).json() as any).plans).length, 1);
  assert.equal((await fetch(`${url}/run`, { method: 'POST', headers })).status, 202);
  let finished = false;
  for (let i = 0; i < 100; i++) {
    const health = await (await fetch(`${url}/health`, { headers })).json() as { running: boolean; lastRunError?: string };
    assert.equal(health.lastRunError, undefined);
    if (!health.running) { finished = true; break; }
    await delay(10);
  }
  assert.equal(finished, true);
  assert.equal((await runner.store.read()).plans['api-plan']?.steps.list?.status, 'COMPLETED');
  console.log('Inbound API authentication, origin rejection, project capability scope and persistence passed.');
} finally { server.close(); server.closeAllConnections(); await once(server, 'close'); await rm(directory, { recursive: true, force: true }); }
