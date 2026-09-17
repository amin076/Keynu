import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ExecutionPlanStore } from '../ExecutionPlanStore.js';
import { MissionExecutionRunner } from '../MissionExecutionRunner.js';
import { executionMonitor } from '../ExecutionMonitor.js';
import { createBuiltinFunctions } from '../../../engineering/functions/BuiltinFunctions.js';
import type { ExecutionAgent } from '../ApiExecutionAgent.js';
const root = await mkdtemp(join(tmpdir(), 'keynu-supervision-'));
try {
  const projectRoot = join(root, 'project'); await mkdir(projectRoot);
  const store = new ExecutionPlanStore(join(root, 'state'));
  const step = { id: 'inspect', goal: 'Inspect project', maxAiCalls: 8, reviewEveryActions: 1,
    allowedFunctions: ['project.list'], verification: [{ name: 'project.list', args: {} }] };
  const plan = { id: 'recurring', projectId: 'fixture', projectRoot, goal: 'Daily inspection', steps: [step] };
  const finish: ExecutionAgent = { decide: async () => ({ kind: 'finish', summary: 'Fixture checked', nextSteps: [] }),
    review: async () => ({ approved: true, reason: 'Fixture verified', nextSteps: [] }) };
  await store.add({ ...plan, recurrence: { intervalMs: 86400000, maxRuns: 2 } });
  const runner = new MissionExecutionRunner(store, createBuiltinFunctions(), finish);
  await runner.run();
  let db = await store.read(); const next = db.plans.recurring!.nextPlanId!;
  assert.ok(next); assert.equal(Object.keys(db.plans).length, 2);
  assert.equal(db.plans[next]!.definition.recurrence, undefined);
  assert.equal(db.plans[next]!.steps.inspect!.status, 'PENDING');
  await runner.run(); assert.equal(Object.keys((await store.read()).plans).length, 2, 'No duplicate recurrence on restart');
  await store.transaction(data => { data.plans[next]!.definition.notBefore = new Date(0).toISOString(); });
  await runner.run(); db = await store.read();
  assert.equal(db.plans[next]!.steps.inspect!.status, 'COMPLETED');
  assert.equal(Object.keys(db.plans).length, 2, 'Maximum scheduled runs must be respected');
  await store.add({ ...plan, id: 'progress' }); let reviews = 0;
  const drifting: ExecutionAgent = { decide: async () => ({ kind: 'call', name: 'project.list', args: {} }),
    review: async (_context, mode) => { reviews++; assert.equal(mode, 'progress'); return { approved: false, reason: 'No useful progress', nextSteps: ['Re-evaluate'] }; } };
  await new MissionExecutionRunner(store, createBuiltinFunctions(), drifting).run();
  assert.equal(reviews, 1); db = await store.read();
  assert.equal(db.plans.progress!.steps.inspect!.status, 'BLOCKED');
  assert.equal(db.plans.progress!.steps.inspect!.aiCalls, 2);
  await store.add({ ...plan, id: 'cancelled' });
  const controller = new AbortController(); let called = false;
  const registry = createBuiltinFunctions();
  const cancelled: ExecutionAgent = { ...finish, decide: async () => {
    controller.abort(); called = true; return { kind: 'call', name: 'project.list', args: {} };
  } };
  await new MissionExecutionRunner(store, registry, cancelled).run(controller.signal);
  assert.equal(called, true);
  assert.equal((await store.history('cancelled')).some(record => record.kind === 'function-result'), false);
  const now = Date.now();
  await store.update('cancelled', 'inspect', { status: 'RUNNING', phase: 'FUNCTION', action: 'fixture',
    lastHeartbeatAt: new Date(now - 60000).toISOString() });
  await store.transaction(data => { data.plans.cancelled!.steps.inspect!.updatedAt = new Date(now - 400000).toISOString(); });
  let observed = executionMonitor(await store.read(), now).plans.find(item => item.id === 'cancelled')!.steps[0]!;
  assert.ok(observed.alerts.includes('WORKER_HEARTBEAT_STALE'));
  assert.ok(observed.alerts.includes('NO_PROGRESS_FOR_FIVE_MINUTES'));
  await store.heartbeat('cancelled', 'inspect');
  observed = executionMonitor(await store.read()).plans.find(item => item.id === 'cancelled')!.steps[0]!;
  assert.ok(!observed.alerts.includes('WORKER_HEARTBEAT_STALE'));
  assert.ok(observed.alerts.includes('NO_PROGRESS_FOR_FIVE_MINUTES'), 'Heartbeat is not evidence of useful progress');
  console.log('Execution supervision: bounded recurrence, progress review, cancellation and heartbeat diagnostics passed.');
} finally { await rm(root, { recursive: true, force: true }); }
