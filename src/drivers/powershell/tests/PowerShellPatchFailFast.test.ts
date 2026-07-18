import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPowerShellPatchJob } from "../powershell-patch.js";

const root = mkdtempSync(join(tmpdir(), "keynu-patch-fail-fast-"));

try {
  const report = await runPowerShellPatchJob({
    protocol: "KAP",
    version: "1.0",
    type: "JOB",
    id: "patch-fail-fast-test",
    payload: {
      target: "powershell",
      cwd: root,
      commands: [
        { command: "node", args: ["-e", "process.exit(1)"] },
        {
          command: "node",
          args: [
            "-e",
            "require('node:fs').writeFileSync('unsafe-continuation.txt','bad')",
          ],
        },
        {
          command: "node",
          args: [
            "-e",
            "require('node:fs').writeFileSync('diagnostic.txt','ok')",
          ],
          runAfterFailure: true,
        },
      ],
    },
  });

  const result = report.payload.result;
  assert.equal(report.payload.status, "FAILED");
  assert.equal(result.commands.length, 3);
  assert.equal(result.commands[0]?.ok, false);
  assert.equal(result.commands[1]?.skipped, true);
  assert.equal(result.commands[1]?.blocked, true);
  assert.equal(result.commands[2]?.ok, true);
  assert.equal(existsSync(join(root, "unsafe-continuation.txt")), false);
  assert.equal(readFileSync(join(root, "diagnostic.txt"), "utf8"), "ok");

  console.log("PowerShell patch fail-fast tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
