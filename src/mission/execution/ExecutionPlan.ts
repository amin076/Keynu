import { z } from 'zod';
import type { ContinuationContract } from '../ContinuationTypes.js';

const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/);
export const FunctionCall = z.object({ name: z.string().min(1), args: z.record(z.string(), z.unknown()) }).strict();
export const ExecutionPlan = z.object({
  id, projectId: id, projectRoot: z.string().min(1), goal: z.string().min(1).max(16000),
  rules: z.array(z.string().max(4000)).max(50).default([]),
  steps: z.array(z.object({
    id, goal: z.string().min(1).max(16000), dependsOn: z.array(id).default([]),
    allowedFunctions: z.array(z.string().min(1)).min(1),
    verification: z.array(FunctionCall).min(1),
    maxAiCalls: z.number().int().min(2).max(100).default(12),
  }).strict()).min(1).max(200),
}).strict().superRefine((plan, ctx) => {
  const ids = new Set(plan.steps.map(step => step.id));
  if (ids.size !== plan.steps.length) ctx.addIssue({ code: 'custom', message: 'Duplicate step id.' });
  const visited = new Set<string>(), visiting = new Set<string>();
  const visit = (stepId: string): void => {
    if (visiting.has(stepId)) { ctx.addIssue({ code: 'custom', message: 'Dependency cycle.' }); return; }
    if (visited.has(stepId)) return;
    const step = plan.steps.find(item => item.id === stepId);
    if (!step) { ctx.addIssue({ code: 'custom', message: `Unknown dependency: ${stepId}` }); return; }
    visiting.add(stepId);
    for (const dep of step.dependsOn) visit(dep);
    visiting.delete(stepId); visited.add(stepId);
    for (const check of step.verification) if (!step.allowedFunctions.includes(check.name)) {
      ctx.addIssue({ code: 'custom', message: `Verification function not allowed: ${check.name}` });
    }
  };
  for (const step of plan.steps) visit(step.id);
});
export type ExecutionPlan = z.infer<typeof ExecutionPlan>;
export type ExecutionStep = ExecutionPlan['steps'][number];
export const AgentDecision = z.discriminatedUnion('kind', [
  FunctionCall.extend({ kind: z.literal('call') }).strict(),
  z.object({ kind: z.literal('finish'), summary: z.string().min(1).max(16000),
    nextSteps: z.array(z.string().max(2000)).max(20) }).strict(),
]);
export const ReviewDecision = z.object({ approved: z.boolean(), reason: z.string().min(1).max(16000),
  nextSteps: z.array(z.string().max(2000)).max(20) }).strict();
export type StepState = {
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'BLOCKED' | 'INTERRUPTED';
  aiCalls: number; updatedAt: string; reason?: string; nextSteps?: string[];
  continuation?: ContinuationContract;
};
export type StoredPlan = { definition: ExecutionPlan; steps: Record<string, StepState> };
export type ExecutionDatabase = { version: 1; plans: Record<string, StoredPlan> };
export type Evidence = { at: string; planId: string; stepId: string; kind: string; data: unknown };
