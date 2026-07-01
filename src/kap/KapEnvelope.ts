import type { Task, TaskPriority, TaskStep } from "../models/Task.js";

export type KapMessageType = "JOB" | "REPORT" | "ERROR" | "EVENT" | "QUESTION";

export type KapJobEnvelope = {
  kap: "1.0";
  type: "JOB";
  id: string;
  createdAt?: string;
  priority?: TaskPriority;
  workflow: {
    steps: TaskStep[];
  };
};

export type KapReportEnvelope = {
  kap: "1.0";
  type: "REPORT" | "ERROR" | "EVENT" | "QUESTION";
  id: string;
  createdAt?: string;
  status?: string;
  payload?: unknown;
};

export type KapEnvelope = KapJobEnvelope | KapReportEnvelope;

export function isKapJobEnvelope(value: unknown): value is KapJobEnvelope {
  if (!value || typeof value !== "object") return false;

  const envelope = value as Partial<KapJobEnvelope>;

  return (
    envelope.kap === "1.0" &&
    envelope.type === "JOB" &&
    typeof envelope.id === "string" &&
    envelope.id.trim().length > 0 &&
    typeof envelope.workflow === "object" &&
    !!envelope.workflow &&
    Array.isArray(envelope.workflow.steps) &&
    envelope.workflow.steps.length > 0
  );
}

export function taskFromKapJob(envelope: KapJobEnvelope): Task {
  return {
    id: envelope.id,
    createdAt: envelope.createdAt ?? new Date().toISOString(),
    priority: envelope.priority ?? "normal",
    steps: envelope.workflow.steps,
  };
}
