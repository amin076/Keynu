import type { ExecutionPlanStore } from './ExecutionPlanStore.js';

export type MissionImpactReport = {
  schemaVersion: 'keynu-mission-impact-0.1';
  generatedAt: string;
  mission: {
    planId: string;
    projectId: string;
    goal: string;
    totalSteps: number;
    completedSteps: number;
    blockedSteps: number;
    pendingSteps: number;
    finalStatus: 'COMPLETED' | 'BLOCKED' | 'IN_PROGRESS';
  };
  reasoning: {
    aiCalls: number;
    aiBypassedSteps: number;
    reasoningRequiredSteps: number;
    actionsPerAiCall: number;
  };
  execution: {
    functionActions: number;
    verificationActions: number;
    totalObservedActions: number;
  };
  resilience: {
    escalationPackets: number;
    escalationCharacters: number;
    recoveryAttempts: number;
    successfulRecoveries: number;
  };
  evidence: {
    records: number;
    firstObservedAt: string | null;
    lastObservedAt: string | null;
    kinds: Record<string, number>;
  };
};

export class MissionImpactReporter {
  constructor(private readonly store: ExecutionPlanStore) {}

  async build(planId: string): Promise<MissionImpactReport> {
    const database = await this.store.read();
    const stored = database.plans[planId];
    if (!stored) throw new Error('Unknown plan.');
    const metrics = await this.store.metrics(planId);
    const history = await this.store.history(planId);
    const states = Object.values(stored.steps);
    const pendingSteps = states.filter(state => ['PENDING', 'RUNNING', 'INTERRUPTED'].includes(state.status)).length;
    const finalStatus = metrics.blockedSteps > 0 ? 'BLOCKED'
      : metrics.completedSteps === stored.definition.steps.length ? 'COMPLETED' : 'IN_PROGRESS';
    const kinds: Record<string, number> = {};
    for (const item of history) kinds[item.kind] = (kinds[item.kind] ?? 0) + 1;

    return {
      schemaVersion: 'keynu-mission-impact-0.1',
      generatedAt: new Date().toISOString(),
      mission: {
        planId,
        projectId: stored.definition.projectId,
        goal: stored.definition.goal,
        totalSteps: stored.definition.steps.length,
        completedSteps: metrics.completedSteps,
        blockedSteps: metrics.blockedSteps,
        pendingSteps,
        finalStatus,
      },
      reasoning: {
        aiCalls: metrics.aiCalls,
        aiBypassedSteps: metrics.aiBypassedSteps,
        reasoningRequiredSteps: metrics.reasoningRequiredSteps,
        actionsPerAiCall: metrics.actionsPerAiCall,
      },
      execution: {
        functionActions: metrics.functionActions,
        verificationActions: metrics.verificationActions,
        totalObservedActions: metrics.functionActions + metrics.verificationActions,
      },
      resilience: {
        escalationPackets: metrics.escalationPackets,
        escalationCharacters: metrics.escalationCharacters,
        recoveryAttempts: metrics.recoveryAttempts,
        successfulRecoveries: metrics.successfulRecoveries,
      },
      evidence: {
        records: history.length,
        firstObservedAt: history.at(0)?.at ?? null,
        lastObservedAt: history.at(-1)?.at ?? null,
        kinds,
      },
    };
  }

  static markdown(report: MissionImpactReport): string {
    const r = report;
    return [
      '# Keynu Mission Impact Report',
      '',
      `**Mission:** ${r.mission.goal}`,
      `**Plan:** \`${r.mission.planId}\``,
      `**Final status:** **${r.mission.finalStatus}**`,
      '',
      '## Mission',
      '',
      `- Steps: ${r.mission.completedSteps}/${r.mission.totalSteps} completed`,
      `- Blocked: ${r.mission.blockedSteps}`,
      `- Pending/interrupted: ${r.mission.pendingSteps}`,
      '',
      '## Reasoning',
      '',
      `- AI calls: ${r.reasoning.aiCalls}`,
      `- AI-bypassed steps: ${r.reasoning.aiBypassedSteps}`,
      `- Reasoning-required steps: ${r.reasoning.reasoningRequiredSteps}`,
      `- Observed actions per AI call: ${r.reasoning.actionsPerAiCall}`,
      '',
      '## Execution and verification',
      '',
      `- Function actions: ${r.execution.functionActions}`,
      `- Verification actions: ${r.execution.verificationActions}`,
      `- Total observed actions: ${r.execution.totalObservedActions}`,
      '',
      '## Resilience',
      '',
      `- Escalation packets: ${r.resilience.escalationPackets}`,
      `- Escalation characters: ${r.resilience.escalationCharacters}`,
      `- Recovery attempts: ${r.resilience.recoveryAttempts}`,
      `- Successful recoveries: ${r.resilience.successfulRecoveries}`,
      '',
      '## Evidence',
      '',
      `- Evidence records: ${r.evidence.records}`,
      `- First observed: ${r.evidence.firstObservedAt ?? 'n/a'}`,
      `- Last observed: ${r.evidence.lastObservedAt ?? 'n/a'}`,
      '',
      '> These are Keynu runtime observations. They are not Bobcoin savings or provider-cost claims.',
      '',
    ].join('\n');
  }
}
