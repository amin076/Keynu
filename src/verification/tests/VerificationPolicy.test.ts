import { resolveVerificationRequirements } from "../VerificationPolicy.js";
import type { RuntimeExecutionResult } from "../../core/results/RuntimeExecutionResult.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function makeResult(result: unknown): RuntimeExecutionResult {
  const now = new Date().toISOString();
  return {
    taskId: "verification-policy-test",
    status: "COMPLETED",
    startedAt: now,
    finishedAt: now,
    durationMs: 1,
    stepsRun: 1,
    steps: [{
      index: 0,
      status: "COMPLETED",
      startedAt: now,
      finishedAt: now,
      durationMs: 1,
      command: {},
      result,
    }],
  };
}

const readOnly = resolveVerificationRequirements(makeResult({
  reads: [{ path: "package.json", ok: true }],
  writes: [],
  build: null,
  git: null,
}));

assert(readOnly.requireFiles === false, "Read-only jobs must not require file-write verification.");
assert(readOnly.requireArtifactIntegrity === false, "Read-only jobs must not require artifact integrity.");
assert(readOnly.requireBuild === false, "Jobs without build evidence must not require build verification.");
assert(readOnly.requireGit === false, "Jobs without git evidence must not require git verification.");

const writeJob = resolveVerificationRequirements(makeResult({
  writes: [{
    path: "tmp/test.txt",
    ok: true,
    artifact: {
      size: 4,
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      modifiedAt: new Date().toISOString(),
    },
  }],
  build: { ok: true },
  git: { status: { ok: true } },
}));

assert(writeJob.requireFiles === true, "Write jobs must require file verification.");
assert(writeJob.requireArtifactIntegrity === true, "Successful writes must require integrity verification.");
assert(writeJob.requireBuild === true, "Build evidence must enable build verification.");
assert(writeJob.requireGit === true, "Git evidence must enable git verification.");

console.log("VERIFICATION_POLICY_TEST_SUITE_PASSED");
