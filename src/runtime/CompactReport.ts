export type CompactCommandResult = {
  command: string;
  ok: boolean;
  output?: string;
  error?: string;
  durationMs?: number;
};

export function compactText(value: unknown, maxChars = 800): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return undefined;
  return text.length > maxChars
    ? text.slice(0, maxChars) + `\n...[truncated ${text.length - maxChars} chars]`
    : text;
}

export function compactCommandResult(result: any): CompactCommandResult {
  return {
    command: String(result?.command ?? "unknown"),
    ok: result?.ok === true,
    output: compactText(result?.stdout),
    error: compactText(result?.error ?? result?.stderr),
    durationMs: typeof result?.durationMs === "number" ? result.durationMs : undefined,
  };
}
