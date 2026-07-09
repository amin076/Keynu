import type { Task } from "../models/Task.js";

export type KapMessageType = "JOB" | "REPORT" | "ERROR" | "QUESTION" | "EVENT";

export type KapEnvelope = {
  protocol: "KAP";
  version: "1.0";
  type: KapMessageType;
  id: string;
  createdAt: string;
  payload: unknown;
};

export type KapJobEnvelope = KapEnvelope & {
  type: "JOB";
  payload: Task;
};

export function isKapJobEnvelope(value: unknown): value is KapJobEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const envelope = value as Partial<KapEnvelope>;

  return (
    envelope.protocol === "KAP" &&
    envelope.version === "1.0" &&
    envelope.type === "JOB" &&
    typeof envelope.id === "string" &&
    envelope.id.trim().length > 0 &&
    typeof envelope.createdAt === "string" &&
    "payload" in envelope
  );
}

export function taskFromKapJob(envelope: KapJobEnvelope): Task {
  return envelope.payload;
}
