import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { withFileLock } from '../../runtime/storage/FileTransaction.js';
import { MemoryLoader } from '../MemoryLoader.js';
import type { FunctionRegistry } from '../../engineering/functions/FunctionRegistry.js';
import type { ExecutionAgent } from './ApiExecutionAgent.js';
import { ExecutionPlanStore } from './ExecutionPlanStore.js';
import { AgentDecision, RepairDecision, ReviewDecision, type ExecutionPlan, type ExecutionStep } from './ExecutionPlan.js';
import { EscalationController } from './EscalationController.js';

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
    // Reasoning gets compact evidence, not a repository dump. Deterministic state
    // remains in Keynu and can be queried through approved functions when needed.
    const memory = new MemoryLoader(plan.projectRoot).loadAll().filter(item => item.exists)
      .map(item => ({ name: item.name, excerpt: item.content?.slice(0, 1200),
        truncated: (item.content?.length ?? 0) > 1200 }));
    const history = (await this.store.history(plan.id)).slice(-8).map(item => {
      const text = JSON.stringify(item.data);
      return { ...item, data: text.length <= 3000 ? item.data : { excerpt: text.slice(0, 3000), truncated: true } };
    });
    const priorPlans = Object.values(database.plans).filter(item => item.definition.projectRoot === plan.projectRoot)
      .slice(-3).map(item => ({ id: item.definition.id, goal: item.definition.goal, steps: item.steps }));
    const bounded = (value: unknown, limit: number): unknown => {
      const text = JSON.stringify(value);
      return text.length <= limit ? value : { excerpt: text.slice(0, limit), truncated: true };
    };
    const context = { goal: plan.goal, rules: plan.rules.slice(0, 8), step,
      functions: this.functions.describe(step.allowedFunctions),
      memory: bounded(memory, 5000), priorPlans: bounded(priorPlans, 3000), history: bounded(history.reverse(), 8000) };
    return bounded(context, 20000);
  }
  private async execute(plan: ExecutionPlan, step: ExecutionStep, signal?: AbortSignal): Promise<void> {
    let failurePhase: 'action' | 'verification' | 'review' | 'budget' | 'interrupt' = 'action';
    await withFileLock(join(plan.projectRoot, '.keynu', 'state', 'mission-execution'), async () => {
      await this.store.update(plan.id, step.id, { status: 'RUNNING', reason: 'Executing approved step.',
        continuation: { decision: 'LOCAL_CONTINUE', owner: 'mission_engine', missionComplete: false,
          reason: 'Execute the next approved plan step.', nextAction: step.id } });
      try {
        this.functions.describe(step.allowedFunctions);

        // Reasoning gate: an explicitly pre-approved deterministic step does not
        // reserve or invoke any AI call. It still uses the same allowlist,
        // schemas, evidence persistence and verification as reasoning steps.
        if (step.executionMode === 'deterministic') {
          await this.store.evidence(plan.id, step.id, 'reasoning-gate', {
            decision: 'BYPASS_AI',
            reason: 'Step contains only pre-approved deterministic actions and verification.',
            actionCount: step.deterministicActions.length,
          });
          for (const action of step.deterministicActions) {
            failurePhase = 'action';
            if (signal?.aborted) { failurePhase = 'interrupt'; throw new Error('Worker stopped before next deterministic action.'); }
            await this.store.evidence(plan.id, step.id, 'function-intent', action);
            const result = await this.functions.invoke(action.name, action.args,
              { projectRoot: plan.projectRoot }, step.allowedFunctions);
            await this.store.evidence(plan.id, step.id, 'function-result', { call: action, result, reasoningBypassed: true });
            if (!result.ok) throw new Error(`Function failed: ${action.name}`);
          }
          for (const check of step.verification) {
            failurePhase = 'verification';
            await this.store.evidence(plan.id, step.id, 'verification-intent', check);
            const result = await this.functions.invoke(check.name, check.args,
              { projectRoot: plan.projectRoot }, step.allowedFunctions);
            await this.store.evidence(plan.id, step.id, 'verification', { check, result, reasoningBypassed: true });
            if (!result.ok) throw new Error(`Verification failed: ${check.name}`);
          }
          const data = await this.store.read();
          const complete = Object.entries(data.plans[plan.id]!.steps)
            .every(([id, state]) => id === step.id || state.status === 'COMPLETED');
          await this.store.update(plan.id, step.id, {
            status: 'COMPLETED',
            reason: 'Pre-approved deterministic actions and verification passed; AI reasoning was bypassed.',
            nextSteps: [],
            continuation: {
              decision: complete ? 'COMPLETED' : 'LOCAL_CONTINUE',
              owner: complete ? 'none' : 'mission_engine',
              missionComplete: complete,
              reason: 'Deterministic execution and verification passed without an AI call.',
              nextAction: complete ? 'Mission plan complete.' : 'Select the next dependency-ready step.',
            },
          });
          return;
        }

        await this.store.evidence(plan.id, step.id, 'reasoning-gate', {
          decision: 'REQUIRE_AI',
          reason: 'Step is marked reasoning and requires an agent decision.',
        });
        while (true) {
          if (signal?.aborted) { failurePhase = 'interrupt'; throw new Error('Worker stopped before next action.'); }
          failurePhase = 'budget';
          await this.store.reserveCall(plan.id, step.id, step.maxAiCalls);
          failurePhase = 'action';
          const decision = AgentDecision.parse(await this.agent.decide(await this.context(plan, step)));
          await this.store.evidence(plan.id, step.id, 'decision', decision);
          if (decision.kind === 'call' || decision.kind === 'batch') {
            const calls = decision.kind === 'batch' ? decision.calls : [decision];
            await this.store.evidence(plan.id, step.id, 'execution-batch', {
              reasoningCall: true, actionCount: calls.length,
            });
            for (const call of calls) {
              // Each intent is persisted before a possibly non-idempotent operation.
              await this.store.evidence(plan.id, step.id, 'function-intent', call);
              const result = await this.functions.invoke(call.name, call.args,
                { projectRoot: plan.projectRoot }, step.allowedFunctions);
              await this.store.evidence(plan.id, step.id, 'function-result', { call, result });
              if (!result.ok) throw new Error(`Function failed: ${call.name}`);
            }
            continue;
          }
          for (const check of step.verification) {
            failurePhase = 'verification';
            await this.store.evidence(plan.id, step.id, 'verification-intent', check);
            const result = await this.functions.invoke(check.name, check.args,
              { projectRoot: plan.projectRoot }, step.allowedFunctions);
            await this.store.evidence(plan.id, step.id, 'verification', { check, result });
            if (!result.ok) throw new Error(`Verification failed: ${check.name}`);
          }
          failurePhase = 'budget';
          await this.store.reserveCall(plan.id, step.id, step.maxAiCalls);
          failurePhase = 'review';
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
        await this.store.evidence(plan.id, step.id, 'blocked', { reason, failurePhase });
        const history = await this.store.history(plan.id);
        const escalation = new EscalationController().build({
          planId: plan.id,
          stepId: step.id,
          goal: step.goal,
          failure: `[${failurePhase}] ${reason}`,
          allowedFunctions: step.allowedFunctions,
          history,
        });
        await this.store.evidence(plan.id, step.id, 'escalation-ready', escalation);

        // Recovery is opt-in, bounded persistently, and receives only the compact
        // escalation packet. It never resets the normal AI-call budget.
        // V1 recovery is intentionally limited to verification failures. Action,
        // review, budget and interrupt failures can have unknown side effects or
        // require operator reconciliation, so they fail closed.
        if (failurePhase === 'verification' && step.recovery.enabled && this.agent.repair) {
          try {
            await this.store.reserveRecovery(plan.id, step.id, step.recovery.maxAttempts);
            await this.store.reserveCall(plan.id, step.id, step.maxAiCalls);
            const repair = RepairDecision.parse(await this.agent.repair(escalation));
            await this.store.evidence(plan.id, step.id, 'repair-decision', repair);
            if (repair.kind === 'repair') {
              for (const call of repair.calls) {
                if (!step.allowedFunctions.includes(call.name)) throw new Error(`Repair function not allowed: ${call.name}`);
                await this.store.evidence(plan.id, step.id, 'repair-intent', call);
                const result = await this.functions.invoke(call.name, call.args,
                  { projectRoot: plan.projectRoot }, step.allowedFunctions);
                await this.store.evidence(plan.id, step.id, 'repair-result', { call, result });
                if (!result.ok) throw new Error(`Repair function failed: ${call.name}`);
              }
              for (const check of step.verification) {
                const result = await this.functions.invoke(check.name, check.args,
                  { projectRoot: plan.projectRoot }, step.allowedFunctions);
                await this.store.evidence(plan.id, step.id, 'recovery-verification', { check, result });
                if (!result.ok) throw new Error(`Recovery verification failed: ${check.name}`);
              }
              await this.store.evidence(plan.id, step.id, 'recovery-succeeded', {
                rationale: repair.rationale, repairActions: repair.calls.length,
              });
              const data = await this.store.read();
              const complete = Object.entries(data.plans[plan.id]!.steps)
                .every(([id, state]) => id === step.id || state.status === 'COMPLETED');
              await this.store.update(plan.id, step.id, {
                status: 'COMPLETED',
                reason: `Recovered from failure: ${repair.rationale}`,
                nextSteps: [],
                continuation: {
                  decision: complete ? 'COMPLETED' : 'LOCAL_CONTINUE',
                  owner: complete ? 'none' : 'mission_engine',
                  missionComplete: complete,
                  reason: 'Targeted repair passed deterministic verification.',
                  nextAction: complete ? 'Mission plan complete.' : 'Select the next dependency-ready step.',
                },
              });
              return;
            }
            await this.store.evidence(plan.id, step.id, 'recovery-stopped', { reason: repair.reason });
          } catch (recoveryError) {
            await this.store.evidence(plan.id, step.id, 'recovery-failed', {
              reason: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
            });
          }
        }

        await this.store.update(plan.id, step.id, { status: 'BLOCKED', reason,
          continuation: { decision: 'BLOCKED', owner: 'user', missionComplete: false,
            reason, nextAction: 'Inspect the bounded escalation/recovery evidence before explicit resume.', retryable: false } });
      }
    });
  }
}
