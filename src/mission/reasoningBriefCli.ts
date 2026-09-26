import { ContextAssembler } from "./ContextAssembler.js";
import { ReasoningBriefBuilder } from "./ReasoningBriefBuilder.js";

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function main(): void {
  const projectId = process.argv[2]?.trim() || undefined;
  const context = new ContextAssembler().assemble(projectId);
  const builder = new ReasoningBriefBuilder({
    maximumCharacters: readPositiveInteger("KEYNU_REASONING_MAX_CHARS", 8000),
    maximumChangedFiles: readPositiveInteger("KEYNU_REASONING_MAX_CHANGED_FILES", 12),
    maximumNextActions: readPositiveInteger("KEYNU_REASONING_MAX_NEXT_ACTIONS", 6),
  });
  process.stdout.write(builder.buildMessage(context) + "\n");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
