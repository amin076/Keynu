import type { VerificationCheck } from "../VerificationResult.js";

export type BuildEvidence = {
  ok: boolean;
  output?: string;
  error?: string;
};

export function checkBuild(
  build: BuildEvidence | null | undefined,
): VerificationCheck {
  const passed = Boolean(build && build.ok);

  return {
    name: "build",
    passed,
    message: passed
      ? "Build completed successfully."
      : "Build evidence is missing or failed.",
  };
}
