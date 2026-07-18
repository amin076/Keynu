import type { VerificationCheck } from "../VerificationResult.js";

export type GitEvidence = {
  branch?: {
    ok: boolean;
    stdout?: string;
  };
  status?: {
    ok: boolean;
    stdout?: string;
  };
};

export function checkGit(
  git: GitEvidence | undefined,
): VerificationCheck {
  const passed = Boolean(
    git &&
      git.branch?.ok === true &&
      git.status?.ok === true,
  );

  return {
    name: "git",
    passed,
    message: passed
      ? "Git repository state collected successfully."
      : "Git verification evidence is missing.",
  };
}
