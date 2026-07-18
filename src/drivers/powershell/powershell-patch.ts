import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  statSync,
} from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import {
  checkPowerShellCommandSafety,
  type PowerShellCommandSpec,
} from "./powershell-safety.js";

const execFileAsync = promisify(execFile);

type WriteFileSpec = {
  path: string;
  content: string;
};

type PatchPayload = {
  target: "powershell";
  cwd: string;
  readFiles?: string[];
  writeFiles?: WriteFileSpec[];
  commands?: PowerShellCommandSpec[];
  continueOnError?: boolean;
  buildCommand?: PowerShellCommandSpec;
  createBackups?: boolean;
  allowDangerousCommands?: boolean;
  reportMode?: "full" | "summary";
};

export type PowerShellPatchJob = {
  protocol: "KAP";
  version: string;
  type: "JOB";
  id: string;
  createdAt?: string;
  payload: PatchPayload;
};

function safeResolve(cwd: string, filePath: string) {
  const fullPath = resolve(cwd, filePath);
  const root = resolve(cwd);

  if (fullPath !== root && !fullPath.startsWith(root + "\\") && !fullPath.startsWith(root + "/")) {
    throw new Error("Unsafe path outside cwd: " + filePath);
  }

  return fullPath;
}

function collectArtifactEvidence(fullPath: string) {
  const data = readFileSync(fullPath);
  const stats = statSync(fullPath);

  return {
    size: stats.size,
    sha256: createHash("sha256").update(data).digest("hex"),
    modifiedAt: stats.mtime.toISOString(),
  };
}

async function runCommand(
  commandSpec: PowerShellCommandSpec,
  cwd: string,
  allowDangerousCommands: boolean,
) {
  const safety = checkPowerShellCommandSafety(commandSpec);
  const command = commandSpec.command;
  const args = commandSpec.args ?? [];
  const startedAt = new Date().toISOString();

  if (!safety.ok && !allowDangerousCommands) {
    return {
      command,
      args,
      ok: false,
      blocked: true,
      safety,
      stdout: "",
      stderr: "",
      error: safety.reason ?? "Command blocked by safety policy",
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  const loweredCommand = command.toLowerCase();
  const safeCommand =
    process.platform === "win32" && loweredCommand === "npm"
      ? "npm.cmd"
      : process.platform === "win32" && loweredCommand === "npx"
        ? "npx.cmd"
        : command;

  const requiresShell =
    process.platform === "win32" &&
    (safeCommand.toLowerCase().endsWith(".cmd") ||
      safeCommand.toLowerCase().endsWith(".bat"));

  try {
    const result = await execFileAsync(safeCommand, args, {
      cwd,
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 20,
      shell: requiresShell,
    });

    return {
      command,
      args,
      ok: true,
      blocked: false,
      stdout: result.stdout,
      stderr: result.stderr,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      command,
      args,
      ok: false,
      blocked: false,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      error: error.message ?? String(error),
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }
}

function backupPath(cwd: string, filePath: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = normalize(filePath).replace(/[\\/]/g, "__");
  return join(
    cwd,
    ".keynu",
    "powershell",
    "backups",
    timestamp + "-" + safeName,
  );
}

function formatCompactCommandFailure(result: { command?: string; blocked?: boolean }, operation = "command"): string {
  const command = result.command ?? "unknown";
  return result.blocked
    ? `${operation} blocked: ${command}`
    : `${operation} failed: ${command}`;
}

export async function runPowerShellPatchJob(job: PowerShellPatchJob) {
  const payload = job.payload;
  const cwd = payload.cwd;
  const startedAt = new Date().toISOString();
  const reads: any[] = [];
  const writes: any[] = [];
  const commands: any[] = [];
  const errors: string[] = [];
  const allowDangerousCommands = payload.allowDangerousCommands === true;
  const reportMode = payload.reportMode ?? "full";

  const requestedOperationCount =
    (payload.readFiles?.length ?? 0) +
    (payload.writeFiles?.length ?? 0) +
    (payload.commands?.length ?? 0) +
    (payload.buildCommand ? 1 : 0);

  if (requestedOperationCount === 0) {
    errors.push(
      "PowerShell patch job contains no executable operations. Provide readFiles, writeFiles, commands, or buildCommand.",
    );
  }

  if (!existsSync(cwd)) {
    throw new Error("cwd does not exist: " + cwd);
  }

  for (const file of payload.writeFiles ?? []) {
    try {
      const fullPath = safeResolve(cwd, file.path);
      mkdirSync(dirname(fullPath), { recursive: true });

      let backup: string | null = null;
      if (payload.createBackups !== false && existsSync(fullPath)) {
        backup = backupPath(cwd, file.path);
        mkdirSync(dirname(backup), { recursive: true });
        copyFileSync(fullPath, backup);
      }

      writeFileSync(fullPath, file.content, "utf8");
      const artifact = collectArtifactEvidence(fullPath);

      writes.push({
        path: file.path,
        ok: true,
        bytes: Buffer.byteLength(file.content),
        backup,
        artifact,
      });

      const readBackContent = readFileSync(fullPath, "utf8");
      const maxReportChars = 12000;
      const readBackReportContent =
        readBackContent.length > maxReportChars
          ? readBackContent.slice(0, maxReportChars)
          : readBackContent;
      const readBackArtifact = collectArtifactEvidence(fullPath);

      reads.push({
        path: file.path,
        ok: true,
        readBack: true,
        content:
          reportMode === "summary" ? undefined : readBackReportContent,
        preview:
          reportMode === "summary"
            ? readBackReportContent.slice(0, 800)
            : undefined,
        bytes: Buffer.byteLength(readBackReportContent),
        truncated: readBackContent.length > maxReportChars,
        originalBytes: Buffer.byteLength(readBackContent),
        artifact: readBackArtifact,
      });
    } catch (error: any) {
      writes.push({
        path: file.path,
        ok: false,
        error: error.message ?? String(error),
      });
      errors.push("write failed: " + file.path);
    }
  }

  for (const filePath of payload.readFiles ?? []) {
    try {
      const fullPath = safeResolve(cwd, filePath);
      const content = readFileSync(fullPath, "utf8");
      const maxReportChars = 12000;
      const reportContent =
        content.length > maxReportChars
          ? content.slice(0, maxReportChars)
          : content;
      const artifact = collectArtifactEvidence(fullPath);

      reads.push({
        path: filePath,
        ok: true,
        content: reportMode === "summary" ? undefined : reportContent,
        preview:
          reportMode === "summary"
            ? reportContent.slice(0, 800)
            : undefined,
        bytes: Buffer.byteLength(reportContent),
        truncated: content.length > maxReportChars,
        originalBytes: Buffer.byteLength(content),
        artifact,
      });
    } catch (error: any) {
      reads.push({
        path: filePath,
        ok: false,
        error: error.message ?? String(error),
      });
      errors.push("read failed: " + filePath);
    }
  }

  let commandChainFailed = false;

  for (const commandSpec of payload.commands ?? []) {
    if (
      commandChainFailed &&
      payload.continueOnError !== true &&
      commandSpec.runAfterFailure !== true
    ) {
      const timestamp = new Date().toISOString();
      commands.push({
        command: commandSpec.command,
        args: commandSpec.args ?? [],
        ok: false,
        blocked: true,
        skipped: true,
        stdout: "",
        stderr: "",
        error: "Skipped because a previous command failed",
        startedAt: timestamp,
        finishedAt: timestamp,
      });
      continue;
    }

    const result = await runCommand(
      commandSpec,
      cwd,
      allowDangerousCommands,
    );
    commands.push(result);

    if (!result.ok) {
      commandChainFailed = true;
      errors.push(formatCompactCommandFailure(result));
    }
  }

  let build = null;
  if (payload.buildCommand) {
    if (
      commandChainFailed &&
      payload.continueOnError !== true &&
      payload.buildCommand.runAfterFailure !== true
    ) {
      const timestamp = new Date().toISOString();
      build = {
        command: payload.buildCommand.command,
        args: payload.buildCommand.args ?? [],
        ok: false,
        blocked: true,
        skipped: true,
        stdout: "",
        stderr: "",
        error: "Skipped because a previous command failed",
        startedAt: timestamp,
        finishedAt: timestamp,
      };
    } else {
      build = await runCommand(
        payload.buildCommand,
        cwd,
        allowDangerousCommands,
      );

      if (!build.ok) {
        commandChainFailed = true;
        errors.push(formatCompactCommandFailure(build, "build"));
      }
    }
  }

  const git = {
    branch: await runCommand(
      { command: "git", args: ["branch", "--show-current"] },
      cwd,
      true,
    ),
    status: await runCommand(
      { command: "git", args: ["status", "--short"] },
      cwd,
      true,
    ),
    diffStat: await runCommand(
      { command: "git", args: ["diff", "--stat"] },
      cwd,
      true,
    ),
  };

  const result = {
    jobId: job.id,
    status: errors.length === 0 ? "COMPLETED" : "FAILED",
    cwd,
    startedAt,
    finishedAt: new Date().toISOString(),
    reads,
    writes,
    commands,
    build,
    git,
    errors,
  };

  return {
    protocol: "KAP",
    version: job.version ?? "1.0",
    type: "REPORT",
    id: "report-" + job.id,
    createdAt: new Date().toISOString(),
    payload: {
      jobId: job.id,
      target: "powershell",
      status: result.status,
      result,
    },
  };
}
