import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, rm, writeFile, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { ExecutionPlan } from '../ExecutionPlan.js';
import { ExecutionPlanStore } from '../ExecutionPlanStore.js';
import { MissionExecutionRunner } from '../MissionExecutionRunner.js';
import type { ExecutionAgent } from '../ApiExecutionAgent.js';
import { createBuiltinFunctions } from '../../../engineering/functions/BuiltinFunctions.js';
import { registerScript } from '../../../engineering/functions/ScriptFunctions.js';

const root = await mkdtemp(join(tmpdir(), 'keynu-mission-test-'));
try {
  const registry = createBuiltinFunctions();
  let active = 0, maximum = 0, verifications = 0, entrants = 0;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  registry.register('test.verify', { description: 'Test check', parameters: z.object({}).strict(), execute: async () => {
    active++; entrants++; maximum = Math.max(maximum, active);
    if (entrants === 3) release();
    if (entrants <= 3) await Promise.race([barrier, delay(3000).then(() => { throw new Error('Concurrent worker barrier timed out'); })]);
    else await delay(30);
    active--; verifications++;
    return { ok: true, summary: 'Verified fixture.' };
  } });
  registry.register('test.fail', { description: 'Fail', parameters: z.object({}).strict(), execute: async () => ({ ok: false, summary: 'failed' }) });
  const step = { id: 'audit', goal: 'Audit fixture', allowedFunctions: ['test.verify'], verification: [{ name: 'test.verify', args: {} }], maxAiCalls: 4 };
  const store = new ExecutionPlanStore(join(root, 'store'));
  for (let i = 0; i < 3; i++) {
    const projectRoot = join(root, `project-${i}`); await mkdir(projectRoot);
    await store.add({ id: `plan-${i}`, projectId: `project-${i}`, projectRoot, goal: 'Audit then improve', steps: [
      step, { ...step, id: 'develop', dependsOn: ['audit'] },
    ] });
  }
  let decisions = 0, reviews = 0;
  const agent: ExecutionAgent = { decide: async () => { decisions++; return { kind: 'finish', summary: 'Fixture inspected', nextSteps: ['Follow-up proposal'] }; },
    review: async () => { reviews++; return { approved: true, reason: 'Evidence supports fixture goal', nextSteps: [] }; } };
  const runner = new MissionExecutionRunner(store, registry, agent, 3);
  await runner.run();
  assert.equal(maximum, 3); assert.equal(decisions, 6); assert.equal(reviews, 6); assert.equal(verifications, 6);
  await new MissionExecutionRunner(new ExecutionPlanStore(store.directory), registry, agent, 3).run();
  assert.equal(decisions, 6, 'Restart must not replay completed work');
  const state = await store.read();
  assert.equal(state.plans['plan-0']!.steps.develop?.continuation?.missionComplete, true);
  assert.equal(state.plans['plan-0']!.steps.audit?.aiCalls, 2);
  assert.equal((await store.history('plan-0')).filter(item => item.kind === 'review').length, 2);
  await assert.rejects(store.add(state.plans['plan-0']!.definition), /already exists/);
  assert.throws(() => ExecutionPlan.parse({ ...state.plans['plan-0']!.definition,
    steps: [{ ...step, dependsOn: ['audit'] }] }), /cycle/);
  await store.add({ id: 'failure', projectId: 'project-0', projectRoot: join(root, 'project-0'), goal: 'Test fail closed',
    steps: [{ ...step, allowedFunctions: ['test.fail'], verification: [{ name: 'test.fail', args: {} }] }, { ...step, id: 'dependent', dependsOn: ['audit'] }] });
  await runner.run();
  assert.equal((await store.read()).plans.failure?.steps.audit?.status, 'BLOCKED');
  assert.equal((await store.read()).plans.failure?.steps.dependent?.status, 'PENDING');
  assert.equal(reviews, 6, 'AI must not override a failing deterministic check');
  const failureEscalation = await store.latestEscalation('failure', 'audit') as {
    purpose: string; failure: string; relevantEvidence: unknown[]; budget: { estimatedCharacters: number; maximumCharacters: number };
  };
  assert.equal(failureEscalation.purpose, 'FAILURE_ESCALATION');
  assert.match(failureEscalation.failure, /Verification failed/);
  assert.ok(failureEscalation.relevantEvidence.length > 0);
  assert.ok(failureEscalation.budget.estimatedCharacters <= failureEscalation.budget.maximumCharacters);
  assert.equal((await store.metrics('failure')).escalationPackets, 1);
  await store.add({ id: 'interrupted', projectId: 'project-0', projectRoot: join(root, 'project-0'), goal: 'Recover safely', steps: [step] });
  await store.update('interrupted', 'audit', { status: 'RUNNING', aiCalls: 1 });
  await runner.run();
  assert.equal((await store.read()).plans.interrupted?.steps.audit?.status, 'INTERRUPTED');
  await runner.resume('interrupted', 'audit'); await runner.run();
  assert.equal((await store.read()).plans.interrupted?.steps.audit?.aiCalls, 3);
  await store.add({ id: 'budget', projectId: 'project-0', projectRoot: join(root, 'project-0'), goal: 'Bound loop',
    steps: [{ ...step, allowedFunctions: ['project.list'], verification: [{ name: 'project.list', args: {} }], maxAiCalls: 2 }] });
  const looping: ExecutionAgent = { ...agent, decide: async () => ({ kind: 'call', name: 'project.list', args: {} }) };
  await new MissionExecutionRunner(store, registry, looping).run();
  assert.equal((await store.read()).plans.budget?.steps.audit?.aiCalls, 2);
  await assert.rejects(runner.resume('budget', 'audit'), /Budget exhausted/);
  await store.add({ id: 'rejected', projectId: 'project-0', projectRoot: join(root, 'project-0'), goal: 'Reject unsupported work', steps: [step] });
  await new MissionExecutionRunner(store, registry, { ...agent, review: async () => ({ approved: false, reason: 'Missing evidence', nextSteps: [] }) }).run();
  assert.equal((await store.read()).plans.rejected?.steps.audit?.status, 'BLOCKED');
  assert.match((await store.read()).plans.rejected?.steps.audit?.reason ?? '', /Review rejected/);
  await mkdir(join(root, 'project-0', 'nested'));
  await assert.rejects(store.add({ id: 'nested', projectId: 'nested', projectRoot: join(root, 'project-0', 'nested'), goal: 'Conflicting root', steps: [step] }), /Overlapping/);
  const context = { projectRoot: join(root, 'project-0') };
  await assert.rejects(registry.invoke('project.read', { path: '../outside' }, context, ['project.read']), /outside/);
  await assert.rejects(registry.invoke('project.read', { path: '.keynu/state/a' }, context, ['project.read']), /Protected/);
  await assert.rejects(registry.invoke('project.write', {}, context, ['project.read']), /not allowed/);
  const file = join(context.projectRoot, 'file.txt'); await writeFile(file, 'original');
  await assert.rejects(registry.invoke('project.write', { path: 'file.txt', content: 'oops', expectedSha256: 'a'.repeat(64) }, context, ['project.write']), /changed/);
  assert.equal(await readFile(file, 'utf8'), 'original');
  if (process.platform !== 'win32') {
    await symlink(join(root, 'outside'), join(context.projectRoot, 'alias'));
    await assert.rejects(registry.invoke('project.write', { path: 'alias', content: 'oops', expectedSha256: null }, context, ['project.write']), /Symbolic/);
  }
  const script = join(root, 'echo.mjs');
  await writeFile(script, "import fs from 'node:fs'; console.log(fs.readFileSync(process.argv[2], 'utf8'));");
  await registerScript(registry, { name: 'fixture.echo', description: 'Echo structured input', runtime: 'node', script, fields: { text: 'string' } });
  const dangerous = 'hello & echo INJECTED $(whoami) `x` "quotes"\nnewline';
  const result = await registry.invoke('fixture.echo', { text: dangerous }, context, ['fixture.echo']);
  assert.equal(result.ok, true);
  assert.equal(JSON.parse((result.data as { stdout: string }).stdout).text, dangerous);
  if (process.platform === 'win32') {
    const psScript = join(root, 'echo.ps1');
    await writeFile(psScript, 'param([string]$ArgumentsFile)\nGet-Content -LiteralPath $ArgumentsFile -Raw');
    await registerScript(registry, { name: 'fixture.powershell', description: 'Echo JSON via PowerShell', runtime: 'powershell', script: psScript, fields: { text: 'string' } });
    const ps = await registry.invoke('fixture.powershell', { text: dangerous }, context, ['fixture.powershell']);
    assert.equal(ps.ok, true);
    assert.equal(JSON.parse((ps.data as { stdout: string }).stdout).text, dangerous);
  }
  await writeFile(script, 'process.exit(0)');
  await assert.rejects(registry.invoke('fixture.echo', { text: 'changed' }, context, ['fixture.echo']), /changed/);
  // One reasoning decision can safely fan out into multiple deterministic actions.
  await store.add({ id: 'amplified', projectId: 'project-0', projectRoot: join(root, 'project-0'), goal: 'Amplify one decision',
    steps: [{ ...step, allowedFunctions: ['project.list'], verification: [{ name: 'project.list', args: {} }], maxAiCalls: 4 }] });
  let amplifiedDecisions = 0;
  const amplified: ExecutionAgent = {
    decide: async () => {
      amplifiedDecisions++;
      return amplifiedDecisions === 1
        ? { kind: 'batch' as const, calls: [
          { name: 'project.list', args: {} },
          { name: 'project.list', args: {} },
        ] }
        : { kind: 'finish' as const, summary: 'Batch evidence collected', nextSteps: [] };
    },
    review: async () => ({ approved: true, reason: 'Batch and verification evidence are present', nextSteps: [] }),
  };
  await new MissionExecutionRunner(store, registry, amplified).run();
  const amplifiedMetrics = await store.metrics('amplified');
  assert.equal(amplifiedMetrics.aiCalls, 3, 'batch decision + finish + review should use three AI calls');
  assert.equal(amplifiedMetrics.functionActions, 2);
  assert.equal(amplifiedMetrics.verificationActions, 1);
  assert.equal(amplifiedMetrics.actionsPerAiCall, 1);
  assert.equal((await store.read()).plans.amplified?.steps.audit?.status, 'COMPLETED');

  // Reasoning gate must spend zero AI calls for explicitly deterministic work.
  let forbiddenAiCalls = 0;
  const noAiAgent: ExecutionAgent = {
    decide: async () => { forbiddenAiCalls++; throw new Error('AI must not be called'); },
    review: async () => { forbiddenAiCalls++; throw new Error('AI review must not be called'); },
  };
  await store.add({ id: 'deterministic', projectId: 'project-0', projectRoot: join(root, 'project-0'), goal: 'Run approved local checks without AI',
    steps: [{
      ...step,
      executionMode: 'deterministic',
      deterministicActions: [
        { name: 'project.list', args: {} },
        { name: 'project.list', args: {} },
      ],
      allowedFunctions: ['project.list'],
      verification: [{ name: 'project.list', args: {} }],
    }] });
  await new MissionExecutionRunner(store, registry, noAiAgent).run();
  const deterministicState = (await store.read()).plans.deterministic?.steps.audit;
  const deterministicMetrics = await store.metrics('deterministic');
  assert.equal(forbiddenAiCalls, 0);
  assert.equal(deterministicState?.aiCalls, 0);
  assert.equal(deterministicState?.status, 'COMPLETED');
  assert.equal(deterministicMetrics.functionActions, 2);
  assert.equal(deterministicMetrics.verificationActions, 1);
  assert.equal(deterministicMetrics.aiBypassedSteps, 1);
  assert.equal(deterministicMetrics.reasoningRequiredSteps, 0);
  assert.throws(() => ExecutionPlan.parse({
    id: 'bad-deterministic', projectId: 'project-0', projectRoot: join(root, 'project-0'), goal: 'Reject unsafe deterministic function',
    steps: [{ ...step, executionMode: 'deterministic', deterministicActions: [{ name: 'project.write', args: {} }] }],
  }), /Deterministic function not allowed/);

  // A deterministic failure creates a compact escalation packet but still spends zero AI calls.
  await store.add({ id: 'deterministic-failure', projectId: 'project-0', projectRoot: join(root, 'project-0'), goal: 'Fail locally then escalate narrowly',
    steps: [{
      ...step,
      executionMode: 'deterministic',
      deterministicActions: [{ name: 'test.fail', args: {} }],
      allowedFunctions: ['test.fail'],
      verification: [{ name: 'test.fail', args: {} }],
    }] });
  await new MissionExecutionRunner(store, registry, noAiAgent).run();
  const deterministicFailureState = (await store.read()).plans['deterministic-failure']?.steps.audit;
  const deterministicFailureEscalation = await store.latestEscalation('deterministic-failure', 'audit') as {
    purpose: string; relevantEvidence: Array<{ kind: string }>; budget: { estimatedCharacters: number };
  };
  assert.equal(deterministicFailureState?.aiCalls, 0);
  assert.equal(deterministicFailureState?.status, 'BLOCKED');
  assert.equal(deterministicFailureEscalation.purpose, 'FAILURE_ESCALATION');
  assert.ok(deterministicFailureEscalation.budget.estimatedCharacters <= 6000);
  assert.ok(deterministicFailureEscalation.relevantEvidence.some(item => item.kind === 'function-result'));

  // Corruption must never reset state or budgets.
  await writeFile(store.file, '{invalid'); await assert.rejects(store.read());
  console.log('Mission execution: concurrency, dependencies, restart, budgets, verification, schemas and script arguments passed.');
} finally { await rm(root, { recursive: true, force: true }); }
