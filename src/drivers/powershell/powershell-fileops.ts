import { collectGitSnapshot, readPowerShellFile, runPowerShellCommand, writePowerShellFile } from "./powershell-runner.js";
import type { PowerShellFileOpsJobPayload } from "./powershell-types.js";

export async function runPowerShellFileOps(jobId: string, payload: PowerShellFileOpsJobPayload) {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  const reads = (payload.readFiles ?? []).map((item) => readPowerShellFile(payload.cwd, item));
  for (const read of reads) if (!read.ok) errors.push(`read failed: ${read.path}`);

  const writes = (payload.writeFiles ?? []).map((item) => writePowerShellFile(payload.cwd, item));
  for (const write of writes) if (!write.ok) errors.push(`write failed: ${write.path}`);

  const commands = [];
  for (const command of payload.commands ?? []) {
    const result = await runPowerShellCommand(payload.cwd, command);
    commands.push(result);
    if (!result.ok) errors.push(`command failed: ${result.command} ${result.args.join(" ")}`.trim());
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
