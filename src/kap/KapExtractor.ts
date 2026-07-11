export type KapEnvelope = {
  protocol: string;
  version: string;
  type: string;
  id: string;
  createdAt?: string;
  payload?: unknown;
};

function isKapEnvelope(value: unknown): value is KapEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const obj = value as Partial<KapEnvelope>;

  return (
    obj.protocol === "KAP" &&
    typeof obj.version === "string" &&
    typeof obj.type === "string" &&
    typeof obj.id === "string"
  );
}

function tryParseJson(candidate: string): KapEnvelope | null {
  try {
    const parsed = JSON.parse(candidate);

    if (isKapEnvelope(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function extractKapEnvelope(text: string): KapEnvelope | null {
  // 1. Extract fenced blocks:
  // ```kap
  // ```kap id="xxx"
  // ```json
  const fencedBlockPattern = /```(?:kap|json)?[^\n]*\n([\s\S]*?)```/gi;

  for (const match of text.matchAll(fencedBlockPattern)) {
    const candidate = match[1]?.trim();

    if (!candidate) {
      continue;
    }

    const result = tryParseJson(candidate);

    if (result) {
      return result;
    }
  }

  // 2. Try raw JSON object inside message
  const jsonObjectPattern = /\{[\s\S]*\}/g;

  for (const match of text.matchAll(jsonObjectPattern)) {
    const candidate = match[0];

    const result = tryParseJson(candidate);

    if (result) {
      return result;
    }
  }

  return null;
}