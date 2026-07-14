import { collectGitSnapshot, readPowerShellFile, runPowerShellCommand, writePowerShellFile } from "./powershell-runner.js";
import type { PowerShellFileOpsJobPayload } from "./powershell-types.js";

function formatCompactCommandFailure(result: { command?: string; blocked?: boolean }): string {
  const command = result.command || "unknown";
  return result.blocked
    ? `command blocked: ${command}`
    : `command failed: ${command}`;
}

export async function runPowerShellFileOps(jobId: string, payload: PowerShellFileOpsJobPayload) {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  const requestedReadCount = payload.readFiles?.length ?? 0;
  const requestedWriteCount = payload.writeFiles?.length ?? 0;
  const requestedCommandCount = payload.commands?.length ?? 0;
  const requestedOperationCount =
    requestedReadCount + requestedWriteCount + requestedCommandCount;

  if (requestedOperationCount === 0) {
    errors.push(
      "PowerShell job contains no executable operations. Provide readFiles, writeFiles, or commands.",
    );
  }

  const reads = (payload.readFiles ?? []).map((item) => readPowerShellFile(payload.cwd, item));
  for (const read of reads) if (!read.ok) errors.push(`read failed: ${read.path}`);

  const writes = (payload.writeFiles ?? []).map((item) => writePowerShellFile(payload.cwd, item));
  for (const write of writes) if (!write.ok) errors.push(`write failed: ${write.path}`);

  const commands = [];
  let commandChainFailed = false;

  for (const command of payload.commands ?? []) {
    if (
      commandChainFailed &&
      payload.continueOnError !== true &&
      command.runAfterFailure !== true
    ) {
      commands.push({
        command: command.command,
        args: command.args ?? [],
        ok: false,
        blocked: true,
        skipped: true,
        stdout: "",
        stderr: "",
        error: "Skipped because a previous command failed",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
      });
      continue;
    }

    const result = await runPowerShellCommand(payload.cwd, command);
    commands.push(result);

    if (!result.ok) {
      commandChainFailed = true;
      errors.push(formatCompactCommandFailure(result));
    }
  }

  const git = payload.includeGit === false ? null : await collectGitSnapshot(payload.cwd);

  return {
    jobId,
    status: errors.length === 0 ? "COMPLETED" : "FAILED",
    cwd: payload.cwd,
    startedAt,
    finishedAt: new Date().toISOString(),
    reads,
    writes,
    commands,
    git,
    errors,
  };
}
