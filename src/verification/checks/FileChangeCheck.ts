import type { RuntimeExecutionResult } from "../../core/results/RuntimeExecutionResult.js";
import type { VerificationCheck } from "../VerificationResult.js";

function containsSuccessfulWrite(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.changed === true) {
    return true;
  }

  if (Array.isArray(candidate.writes)) {
    return candidate.writes.some((write) => {
      if (!write || typeof write !== "object") {
        return false;
      }

      const item = write as Record<string, unknown>;
      return item.ok === true && typeof item.path === "string";
    });
  }

  if (candidate.result && containsSuccessfulWrite(candidate.result)) {
    return true;
  }

  return false;
}

export function checkFileChanges(
  result: RuntimeExecutionResult,
): VerificationCheck {
  const hasChanges = result.steps.some((step) =>
    containsSuccessfulWrite(step.result),
  );

  return {
    name: "files",
    passed: hasChanges,
    message: hasChanges
      ? "Successful file-write evidence detected."
      : "No successful file-write evidence detected.",
  };
}
