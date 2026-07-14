import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPowerShellFileOps } from "../powershell-fileops.js";

const root = mkdtempSync(join(tmpdir(), "keynu-fail-fast-"));

try {
  const report = await runPowerShellFileOps("fail-fast-test", {
    target: "powershell",
    cwd: root,
    commands: [
      { command: "node", args: ["-e", "process.exit(1)"] },
      { command: "node", args: ["-e", "require('node:fs').writeFileSync('should-not-exist.txt','bad')"] },
      { command: "node", args: ["-e", "require('node:fs').writeFileSync('diagnostic.txt','ok')"], runAfterFailure: true },
    ],
  });

  assert.equal(report.status, "FAILED");
  assert.equal(report.commands.length, 3);
  assert.equal(report.commands[0]?.ok, false);
  assert.equal(report.commands[1]?.skipped, true);
  assert.equal(report.commands[1]?.blocked, true);
  assert.equal(report.commands[2]?.ok, true);
  assert.throws(() => readFileSync(join(root, "should-not-exist.txt"), "utf8"));
  assert.equal(readFileSync(join(root, "diagnostic.txt"), "utf8"), "ok");

  const continueReport = await runPowerShellFileOps("continue-test", {
    target: "powershell",
    cwd: root,
    continueOnError: true,
    commands: [
      { command: "node", args: ["-e", "process.exit(1)"] },
      { command: "node", args: ["-e", "require('node:fs').writeFileSync('continued.txt','yes')"] },
    ],
  });

  assert.equal(continueReport.status, "FAILED");
  assert.equal(continueReport.commands[1]?.ok, true);
  assert.equal(readFileSync(join(root, "continued.txt"), "utf8"), "yes");

  console.log("PowerShell fail-fast tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
