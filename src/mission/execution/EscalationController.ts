import type { Evidence } from './ExecutionPlan.js';

export type EscalationPacket = {
  schemaVersion: 'keynu-escalation-0.1';
  purpose: 'FAILURE_ESCALATION';
  planId: string;
  stepId: string;
  goal: string;
  failure: string;
  relevantEvidence: Array<{
    kind: string;
    at: string;
    data: unknown;
  }>;
  allowedFunctions: string[];
  instructions: string[];
  budget: {
    maximumCharacters: number;
    estimatedCharacters: number;
    truncated: boolean;
  };
};

export class EscalationController {
  constructor(private readonly maximumCharacters = 6000, private readonly maximumEvidence = 6) {
    if (!Number.isInteger(maximumCharacters) || maximumCharacters < 2000) {
      throw new Error('Escalation maximumCharacters must be an integer >= 2000.');
    }
    if (!Number.isInteger(maximumEvidence) || maximumEvidence < 1 || maximumEvidence > 20) {
      throw new Error('Escalation maximumEvidence must be 1..20.');
    }
  }

  build(input: {
    planId: string;
    stepId: string;
    goal: string;
    failure: string;
    allowedFunctions: string[];
    history: Evidence[];
  }): EscalationPacket {
    const relevantKinds = new Set([
      'function-intent', 'function-result', 'verification-intent', 'verification',
      'execution-batch', 'reasoning-gate', 'blocked',
    ]);
    const evidence = input.history
      .filter(item => item.stepId === input.stepId && relevantKinds.has(item.kind))
      .slice(-this.maximumEvidence)
      .map(item => ({ kind: item.kind, at: item.at, data: this.bound(item.data, 1200) }));

    const packet: EscalationPacket = {
      schemaVersion: 'keynu-escalation-0.1',
      purpose: 'FAILURE_ESCALATION',
      planId: input.planId,
      stepId: input.stepId,
      goal: input.goal.slice(0, 1200),
      failure: input.failure.slice(0, 1600),
      relevantEvidence: evidence,
      allowedFunctions: input.allowedFunctions.slice(0, 20),
      instructions: [
        'Diagnose only this failed step from the supplied evidence.',
        'Do not request a repository-wide audit.',
        'Prefer a minimal repair or one specific missing artifact.',
        'Return actions only from allowedFunctions; Keynu will execute and verify them.',
      ],
      budget: {
        maximumCharacters: this.maximumCharacters,
        estimatedCharacters: 0,
        truncated: evidence.length < input.history.filter(item => item.stepId === input.stepId && relevantKinds.has(item.kind)).length,
      },
    };

    while (this.measure(packet) > this.maximumCharacters && packet.relevantEvidence.length > 1) {
      packet.relevantEvidence.shift();
      packet.budget.truncated = true;
    }
    if (this.measure(packet) > this.maximumCharacters) {
      packet.failure = packet.failure.slice(0, 600);
      packet.goal = packet.goal.slice(0, 500);
      packet.relevantEvidence = packet.relevantEvidence.map(item => ({
        ...item, data: this.bound(item.data, 500),
      }));
      packet.budget.truncated = true;
    }
    packet.budget.estimatedCharacters = this.measure(packet);
    return packet;
  }

  private bound(value: unknown, limit: number): unknown {
    const text = JSON.stringify(value);
    return text.length <= limit ? value : { excerpt: text.slice(0, limit), truncated: true };
  }

  private measure(value: unknown): number {
    return JSON.stringify(value).length;
  }
}
