import type { RuntimeExecutionResult } from "../../core/results/RuntimeExecutionResult.js";
import type { VerificationCheck } from "../VerificationResult.js";

function containsRealDriverOperation(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsRealDriverOperation);

  const candidate = value as Record<string, unknown>;

  const reads = Array.isArray(candidate.reads) ? candidate.reads : [];
  const writes = Array.isArray(candidate.writes) ? candidate.writes : [];
  const commands = Array.isArray(candidate.commands) ? candidate.commands : [];

  if (reads.length > 0 || writes.length > 0 || commands.length > 0) {
    return true;
  }

  if (candidate.build && typeof candidate.build === "object") {
    return true;
  }

  return Object.entries(candidate).some(([key, nested]) => {
    if (key === "git" || key === "verification" || key === "certificate") {
      return false;
    }
    return containsRealDriverOperation(nested);
  });
}

export function checkEvidence(
  result: RuntimeExecutionResult,
): VerificationCheck {
  const hasStepEvidence =
    Array.isArray(result.steps) &&
    result.steps.length > 0 &&
    result.steps.every(
      (step) =>
        step.status === "COMPLETED" &&
        "result" in step &&
        step.result !== undefined,
    );

  const hasRealOperation = containsRealDriverOperation(result);
  const hasEvidence = hasStepEvidence && hasRealOperation;

  return {
    name: "evidence",
    passed: hasEvidence,
    message: hasEvidence
      ? "Execution evidence contains at least one real driver operation."
      : "Execution evidence is missing or contains no real driver operation.",
  };
}
