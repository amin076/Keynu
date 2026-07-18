import type { Task } from "../models/Task.js";

export type KapMessageType =
  | "MISSION_BOOTSTRAP"
  | "MISSION_ACK"
  | "JOB"
  | "REPORT"
  | "ERROR"
  | "CONTROL"
  | "WAITING_USER"
  | "WAITING_EXTERNAL_SYSTEM"
  | "BLOCKED"
  | "COMPLETED"
  | "FAILED"
  | "CAPABILITIES";

export type KapRetryPolicy = {
  attempt?: number;
  maximumAttempts?: number;
  retryable?: boolean;
  retryAfterMs?: number;
};

export type KapChunkInfo = {
  chunkId: string;
  chunkIndex: number;
  chunkCount: number;
  finalChunk: boolean;
  checksum?: string;
};

export type KapEnvelopeMetadata = {
  correlationId?: string;
  replyTo?: string;
  traceId?: string;
  missionId?: string;
  workflowId?: string;
  sequence?: number;
  idempotencyKey?: string;
  contentType?: string;
  schema?: string;
  deadlineAt?: string;
  retry?: KapRetryPolicy;
  chunk?: KapChunkInfo;
  extensions?: Record<string, unknown>;
};

export type KapEnvelope<TPayload = unknown> = {
  protocol: "KAP";
  version: string;
  type: KapMessageType | string;
  id: string;
  createdAt?: string;
  payload?: TPayload;
  metadata?: KapEnvelopeMetadata;
};

export function isKapEnvelope(value: unknown): value is KapEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<KapEnvelope>;
  return (
    envelope.protocol === "KAP" &&
    typeof envelope.version === "string" &&
    envelope.version.length > 0 &&
    typeof envelope.type === "string" &&
    envelope.type.length > 0 &&
    typeof envelope.id === "string" &&
    envelope.id.length > 0
  );
}

export type KapJobEnvelope = KapEnvelope<Task> & {
  type: "JOB";
  payload: Task;
};

export function isKapJobEnvelope(value: unknown): value is KapJobEnvelope {
  if (!isKapEnvelope(value) || value.type !== "JOB") return false;
  const envelope = value as KapEnvelope;
  return typeof envelope.createdAt === "string" && "payload" in envelope;
}

export function taskFromKapJob(envelope: KapJobEnvelope): Task {
  return envelope.payload;
}
