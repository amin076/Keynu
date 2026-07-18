import { checkFileChanges } from "../checks/FileChangeCheck.js";
import { checkArtifactIntegrity } from "../checks/ArtifactIntegrityCheck.js";
import type { RuntimeExecutionResult } from "../../core/results/RuntimeExecutionResult.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function createResult(result: unknown): RuntimeExecutionResult {
  const now = new Date().toISOString();
  return {
    taskId: "verification-check-test",
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
      result
    }]
  };
}

const readOnly = createResult({ reads: [{ path: "package.json", ok: true }], writes: [] });
const failedWrite = createResult({ writes: [{ path: "tmp/failed.txt", ok: false }] });
const successfulWrite = createResult({ writes: [{ path: "tmp/success.txt", ok: true }] });

assert(checkFileChanges(readOnly).passed === false, "Read-only evidence must fail.");
assert(checkFileChanges(failedWrite).passed === false, "Failed writes must fail.");
assert(checkFileChanges(successfulWrite).passed === true, "Successful writes must pass.");

const now = new Date().toISOString();
const hashA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const hashB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const valid = createResult({
  writes: [{ path: "tmp/artifact.txt", ok: true, artifact: { size: 4, sha256: hashA, modifiedAt: now } }],
  reads: [{ path: "tmp/artifact.txt", ok: true, artifact: { size: 4, sha256: hashA, modifiedAt: now } }]
});

const tampered = createResult({
  writes: [{ path: "tmp/artifact.txt", ok: true, artifact: { size: 4, sha256: hashA, modifiedAt: now } }],
  reads: [{ path: "tmp/artifact.txt", ok: true, artifact: { size: 5, sha256: hashB, modifiedAt: now } }]
});

assert(checkArtifactIntegrity(valid).passed === true, "Valid artifact must pass.");
assert(checkArtifactIntegrity(tampered).passed === false, "Tampered artifact must fail.");

console.log("VERIFICATION_CHECKS_TEST_SUITE_PASSED");
