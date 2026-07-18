import type { RuntimeExecutionResult } from "../../core/results/RuntimeExecutionResult.js";
import type { VerificationCheck } from "../VerificationResult.js";

export function checkExecution(
  result: RuntimeExecutionResult,
): VerificationCheck {
  return {
    name: "execution",
    passed: result.status === "COMPLETED",
    message:
      result.status === "COMPLETED"
        ? "Runtime execution completed successfully."
        : "Runtime execution failed.",
  };
}
