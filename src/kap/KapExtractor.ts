import type { KapEnvelope } from "./KapEnvelope.js";
import { validateKapEnvelope } from "./KapValidator.js";

function tryParseJson(candidate: string): KapEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(candidate);
    const validation = validateKapEnvelope(parsed);

    if (!validation.valid) {
      return null;
    }

    return validation.value as KapEnvelope;
  } catch {
    return null;
  }
}

export function extractKapEnvelope(text: string): KapEnvelope | null {
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

  const jsonObjectPattern = /\{[\s\S]*\}/g;

  for (const match of text.matchAll(jsonObjectPattern)) {
    const result = tryParseJson(match[0]);

    if (result) {
      return result;
    }
  }

  return null;
}
