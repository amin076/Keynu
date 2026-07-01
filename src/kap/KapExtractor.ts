import type { KapEnvelope } from "./KapEnvelope.js";

const KAP_BLOCK_REGEX = /```kap\s*([\s\S]*?)```/i;

export function extractKapEnvelope(text: string): KapEnvelope | null {
  const match = text.match(KAP_BLOCK_REGEX);

  if (!match?.[1]) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return null;
  }

  if (!isKapEnvelope(parsed)) {
    return null;
  }

  return parsed;
}

export function isKapEnvelope(value: unknown): value is KapEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const envelope = value as Partial<KapEnvelope>;

  return (
    envelope.protocol === "KAP" &&
    envelope.version === "1.0" &&
    isKapMessageType(envelope.type) &&
    typeof envelope.id === "string" &&
    envelope.id.trim().length > 0 &&
    typeof envelope.createdAt === "string" &&
    "payload" in envelope
  );
}

function isKapMessageType(value: unknown): boolean {
  return (
    value === "JOB" ||
    value === "REPORT" ||
    value === "ERROR" ||
    value === "QUESTION" ||
    value === "EVENT"
  );
}