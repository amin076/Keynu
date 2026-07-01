import type { KapEnvelope } from "./KapEnvelope.js";

const MARKDOWN_KAP_BLOCK_REGEX = /```kap\s*([\s\S]*?)```/i;
const DOM_KAP_BLOCK_REGEX = /^\s*kap\s*({[\s\S]*})\s*$/i;

export function extractKapEnvelope(text: string): KapEnvelope | null {
  const jsonText = extractKapJsonText(text);

  if (!jsonText) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (!isKapEnvelope(parsed)) {
    return null;
  }

  return parsed;
}

function extractKapJsonText(text: string): string | null {
  const markdownMatch = text.match(MARKDOWN_KAP_BLOCK_REGEX);

  if (markdownMatch?.[1]) {
    return markdownMatch[1].trim();
  }

  const domMatch = text.match(DOM_KAP_BLOCK_REGEX);

  if (domMatch?.[1]) {
    return domMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1).trim();

    if (candidate.includes('"protocol"') && candidate.includes('"KAP"')) {
      return candidate;
    }
  }

  return null;
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
