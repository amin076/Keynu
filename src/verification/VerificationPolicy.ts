import type { RuntimeExecutionResult } from "../core/results/RuntimeExecutionResult.js";

export type VerificationRequirements = {
  requireExecution: boolean;
  requireEvidence: boolean;
  requireFiles: boolean;
  requireArtifactIntegrity: boolean;
  requireBuild: boolean;
  requireGit: boolean;
};

function visit(value: unknown, predicate: (candidate: Record<string, unknown>) => boolean): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (predicate(candidate)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => visit(item, predicate));
  }

  return Object.values(candidate).some((item) => visit(item, predicate));
}

export function resolveVerificationRequirements(
  result: RuntimeExecutionResult,
): VerificationRequirements {
  const hasWrites = visit(result, (candidate) =>
    Array.isArray(candidate.writes) && candidate.writes.length > 0,
  );

  const hasSuccessfulWrites = visit(result, (candidate) =>
    Array.isArray(candidate.writes) &&
    candidate.writes.some((write) => {
      if (!write || typeof write !== "object") return false;
      return (write as Record<string, unknown>).ok === true;
    }),
  );

  const hasBuildEvidence = visit(result, (candidate) => {
    const build = candidate.build;
    return build !== undefined && build !== null;
  });

  const hasGitEvidence = visit(result, (candidate) => {
    const git = candidate.git;
    return git !== undefined && git !== null;
  });

  return {
    requireExecution: true,
    requireEvidence: true,
    requireFiles: hasWrites,
    requireArtifactIntegrity: hasSuccessfulWrites,
    requireBuild: hasBuildEvidence,
    requireGit: hasGitEvidence,
  };
}
