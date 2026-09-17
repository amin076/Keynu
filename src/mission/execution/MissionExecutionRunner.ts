import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { withFileLock } from '../../runtime/storage/FileTransaction.js';
import { MemoryLoader } from '../MemoryLoader.js';
import type { FunctionRegistry } from '../../engineering/functions/FunctionRegistry.js';
import type { ExecutionAgent } from './ApiExecutionAgent.js';
import { ExecutionPlanStore } from './ExecutionPlanStore.js';
import { AgentDecision, ReviewDecision, type ExecutionPlan, type ExecutionStep } from './ExecutionPlan.js';

export class MissionExecutionRunner {
  constructor(readonly store: ExecutionPlanStore, private readonly functions: FunctionRegistry,
    private readonly agent: ExecutionAgent, private readonly concurrency = 3) {
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('Concurrency must be 1..4.');
  }
  async run(signal?: AbortSignal): Promise<void> {
    // Only one scheduler owns a store; workers execute independent projects concurrently.
    await withFileLock(join(this.store.directory, 'runner'), async () => {
      await this.store.transaction(data => {
        for (const plan of Object.values(data.plans)) for (const state of Object.values(plan.steps)) {
          if (state.status === 'RUNNING') Object.assign(state, { status: 'INTERRUPTED',
            reason: 'Previous owner stopped mid-step. Reconcile evidence before explicit resume.', updatedAt: new Date().toISOString() });
        }
      });
      while (!signal?.aborted) {
        const data = await this.store.read();
        const batch: Array<{ plan: ExecutionPlan; step: ExecutionStep }> = [];
        const roots = new Set<string>();
        for (const stored of Object.values(data.plans)) {
          for (const step of stored.definition.steps) {
            if (stored.steps[step.id]?.status !== 'PENDING') continue;
            if (!step.dependsOn.every(id => stored.steps[id]?.status === 'COMPLETED')) continue;
            const root = await realpath(stored.definition.projectRoot);
            const key = process.platform === 'win32' ? root.toLowerCase() : root;
            if (roots.has(key) || batch.length >= this.concurrency) continue;
            roots.add(key); batch.push({ plan: { ...stored.definition, projectRoot: root }, step });
          }
        }
        if (!batch.length) return;
        const results = await Promise.allSettled(batch.map(({ plan, step }) => this.execute(plan, step, signal)));
        // Persistence or ownership failures are fatal; do not silently keep scheduling.
        const failure = results.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
      }
    });
  }
  async resume(planId: string, stepId: string): Promise<void> {
    await withFileLock(join(this.store.directory, 'runner'), async () => {
      await this.store.transaction(data => {
        const state = data.plans[planId]?.steps[stepId];
        if (!state || !['BLOCKED', 'INTERRUPTED'].includes(state.status)) throw new Error('Only blocked/interrupted steps can resume.');
        const step = data.plans[planId]!.definition.steps.find(item => item.id === stepId)!;
        if (state.aiCalls >= step.maxAiCalls) throw new Error('Budget exhausted. Add a reviewed follow-up plan; resume cannot reset the budget.');
        state.status = 'PENDING'; state.reason = 'Explicitly resumed after evidence reconciliation.';
        state.updatedAt = new Date().toISOString();
      });
      await this.store.evidence(planId, stepId, 'resume', { reason: 'Operator requested resume; budget retained.' });
    });
  }
  private async context(plan: ExecutionPlan, step: ExecutionStep): Promise<unknown> {
    const database = await this.store.read();
    const memory = new MemoryLoader(plan.projectRoot).loadAll().filter(item => item.exists)
      .map(item => ({ name: item.name, content: item.content?.slice(0, 4000), truncated: (item.content?.length ?? 0) > 4000 }));
    const history = (await this.store.history(plan.id)).slice(-20).map(item => {
      const text = JSON.stringify(item.data);
      return { ...item, data: text.length <= 12000 ? item.data : { excerpt: text.slice(0, 12000), truncated: true } };
    });
    const priorPlans = Object.values(database.plans).filter(item => item.definition.projectRoot === plan.projectRoot)
      .slice(-10).map(item => ({ id: item.definition.id, goal: item.definition.goal, steps: item.steps }));
    const bounded = (value: unknown, limit: number): unknown => {
      const text = JSON.stringify(value);
      return text.length <= limit ? value : { excerpt: text.slice(0, limit), truncated: true };
    };
    return { goal: plan.goal, rules: plan.rules, step, functions: this.functions.describe(step.allowedFunctions),
      memory: bounded(memory, 16000), priorPlans: bounded(priorPlans, 16000), history: bounded(history.reverse(), 48000) };
  }
  private async execute(plan: ExecutionPlan, step: ExecutionStep, signal?: AbortSignal): Promise<void> {
    await withFileLock(join(plan.projectRoot, '.keynu', 'state', 'mission-execution'), async () => {
      await this.store.update(plan.id, step.id, { status: 'RUNNING', reason: 'Executing approved step.',
        continuation: { decision: 'LOCAL_CONTINUE', owner: 'mission_engine', missionComplete: false,
          reason: 'Execute the next approved plan step.', nextAction: step.id } });
      try {
        this.functions.describe(step.allowedFunctions);
        while (true) {
          if (signal?.aborted) throw new Error('Worker stopped before next action.');
          await this.store.reserveCall(plan.id, step.id, step.maxAiCalls);
          const decision = AgentDecision.parse(await this.agent.decide(await this.context(plan, step)));
          await this.store.evidence(plan.id, step.id, 'decision', decision);
          if (decision.kind === 'call') {
            // Intent is persisted before a possibly non-idempotent operation.
            const result = await this.functions.invoke(decision.name, decision.args,
              { projectRoot: plan.projectRoot }, step.allowedFunctions);
            await this.store.evidence(plan.id, step.id, 'function-result', { call: decision, result });
            if (!result.ok) throw new Error(`Function failed: ${decision.name}`);
            continue;
          }
          for (const check of step.verification) {
            await this.store.evidence(plan.id, step.id, 'verification-intent', check);
            const result = await this.functions.invoke(check.name, check.args,
              { projectRoot: plan.projectRoot }, step.allowedFunctions);
            await this.store.evidence(plan.id, step.id, 'verification', { check, result });
            if (!result.ok) throw new Error(`Verification failed: ${check.name}`);
          }
          await this.store.reserveCall(plan.id, step.id, step.maxAiCalls);
          const review = ReviewDecision.parse(await this.agent.review({ context: await this.context(plan, step), completion: decision }));
          await this.store.evidence(plan.id, step.id, 'review', review);
          if (!review.approved) throw new Error(`Review rejected: ${review.reason}`);
          const data = await this.store.read();
          const complete = Object.entries(data.plans[plan.id]!.steps).every(([id, state]) => id === step.id || state.status === 'COMPLETED');
          await this.store.update(plan.id, step.id, { status: 'COMPLETED', reason: `${decision.summary}\nReview: ${review.reason}`,
            nextSteps: [...decision.nextSteps, ...review.nextSteps],
            continuation: { decision: complete ? 'COMPLETED' : 'LOCAL_CONTINUE', owner: complete ? 'none' : 'mission_engine',
              missionComplete: complete, reason: 'Verification and review passed.', nextAction: complete ? 'Review saved follow-up proposals.' : 'Select the next dependency-ready step.' } });
          return;
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await this.store.evidence(plan.id, step.id, 'blocked', { reason });
        await this.store.update(plan.id, step.id, { status: 'BLOCKED', reason,
          continuation: { decision: 'BLOCKED', owner: 'user', missionComplete: false,
            reason, nextAction: 'Inspect evidence and reconcile before resuming.', retryable: false } });
      }
    });
  }
}
