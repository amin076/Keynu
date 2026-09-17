import type { ExecutionDatabase } from './ExecutionPlan.js';

/** Observations only: a stale heartbeat never authorizes replay or lock stealing. */
export function executionMonitor(database: ExecutionDatabase, now = Date.now()) {
  return {
    generatedAt: new Date(now).toISOString(), paused: database.paused === true,
    plans: Object.values(database.plans).map(({ definition: plan, steps, nextPlanId }) => ({
      id: plan.id, projectId: plan.projectId, goal: plan.goal, notBefore: plan.notBefore,
      recurrence: plan.recurrence, nextPlanId,
      steps: plan.steps.map(step => {
        const state = steps[step.id]!;
        const waitingFor = step.dependsOn.filter(id => steps[id]?.status !== 'COMPLETED');
        const heartbeatAgeMs = state.lastHeartbeatAt ? Math.max(0, now - Date.parse(state.lastHeartbeatAt)) : null;
        const progressAgeMs = Math.max(0, now - Date.parse(state.updatedAt));
        const running = state.status === 'RUNNING';
        return { id: step.id, goal: step.goal, status: state.status, phase: state.phase, action: state.action,
          ready: !database.paused && state.status === 'PENDING' && !waitingFor.length && (!plan.notBefore || Date.parse(plan.notBefore) <= now),
          waitingFor, reason: state.reason, aiCalls: state.aiCalls, maxAiCalls: step.maxAiCalls,
          heartbeatAgeMs, progressAgeMs,
          alerts: [
            ...(running && (heartbeatAgeMs === null || heartbeatAgeMs > 30000) ? ['WORKER_HEARTBEAT_STALE'] : []),
            ...(running && progressAgeMs > 300000 ? ['NO_PROGRESS_FOR_FIVE_MINUTES'] : []),
            ...(state.aiCalls >= step.maxAiCalls && state.status !== 'COMPLETED' ? ['AI_CALL_BUDGET_EXHAUSTED'] : []),
            ...(waitingFor.some(id => ['BLOCKED', 'INTERRUPTED'].includes(steps[id]!.status)) ? ['DEPENDENCY_REQUIRES_ATTENTION'] : []),
          ], nextSteps: state.nextSteps, continuation: state.continuation };
      }),
    })),
  };
}
