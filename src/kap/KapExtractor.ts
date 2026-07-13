import type { KapEnvelope } from "./KapEnvelope.js";
import { validateKapEnvelope } from "./KapValidator.js";

function tryParseJson(candidate: string): KapEnvelope | null {
  const normalized = candidate
    .trim()
    .replace(/^\s*(?:kap|json)\s*(?=\{)/i, "");

  try {
    const parsed: unknown = JSON.parse(normalized);
    const validation = validateKapEnvelope(parsed);

    return validation.valid
      ? (validation.value as KapEnvelope)
      : null;
  } catch {
    return null;
  }
}

function extractBalancedJson(text: string): string[] {
  const candidates: string[] = [];

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") {
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const character = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }

        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;

        if (depth === 0) {
          candidates.push(text.slice(start, index + 1));
          break;
        }
      }
    }
  }

  return candidates;
}

export function extractKapEnvelope(text: string): KapEnvelope | null {
  const fencedBlockPattern = /```(?:kap|json)?[^\n]*\n([\s\S]*?)```/gi;

  for (const match of text.matchAll(fencedBlockPattern)) {
    const result = tryParseJson(match[1] ?? "");

    if (result) {
      return result;
    }
  }

  for (const candidate of extractBalancedJson(text)) {
    const result = tryParseJson(candidate);

    if (result) {
      return result;
    }
  }

  return tryParseJson(text);
}
