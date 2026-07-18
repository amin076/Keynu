import { runPowerShellPatchJob } from "../../drivers/powershell/powershell-patch.js";
import { checkArtifactIntegrity } from "../checks/ArtifactIntegrityCheck.js";
import type { RuntimeExecutionResult } from "../../core/results/RuntimeExecutionResult.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const testPath = ".keynu/tests/automatic-readback-test.txt";
const content = "KEYNU_AUTOMATIC_READBACK_OK\n";

const report = await runPowerShellPatchJob({
  protocol: "KAP",
  version: "1.0",
  type: "JOB",
  id: "automatic-readback-test",
  payload: {
    target: "powershell",
    cwd: process.cwd(),
    writeFiles: [{ path: testPath, content }],
    readFiles: [],
    createBackups: false,
    reportMode: "summary",
  },
});

const execution = report.payload.result as unknown as RuntimeExecutionResult & {
  reads?: Array<{ path?: string; ok?: boolean; readBack?: boolean; artifact?: { sha256?: string; size?: number } }>;
  writes?: Array<{ path?: string; ok?: boolean; artifact?: { sha256?: string; size?: number } }>;
};

const read = execution.reads?.find((item) => item.path === testPath);
const write = execution.writes?.find((item) => item.path === testPath);

assert(write?.ok === true, "Test artifact was not written.");
assert(read?.ok === true, "Written artifact was not automatically read back.");
assert(read?.readBack === true, "Automatic read-back was not identified.");
assert(read?.artifact?.sha256 === write?.artifact?.sha256, "Read/write SHA-256 values differ.");
assert(read?.artifact?.size === write?.artifact?.size, "Read/write sizes differ.");

const integrity = checkArtifactIntegrity({
  taskId: "automatic-readback-test",
  status: "COMPLETED",
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: 1,
  stepsRun: 1,
  steps: [{
    index: 0,
    status: "COMPLETED",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: 1,
    command: {},
    result: execution,
  }],
});

assert(integrity.passed === true, integrity.message ?? "Artifact-integrity verification failed.");
console.log("AUTOMATIC_POST_WRITE_READBACK_TEST_PASSED");
