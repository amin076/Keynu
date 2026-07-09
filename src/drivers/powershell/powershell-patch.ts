import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { checkPowerShellCommandSafety, type PowerShellCommandSpec } from "./powershell-safety.js";

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

  if (!fullPath.startsWith(root)) {
    throw new Error("Unsafe path outside cwd: " + filePath);
  }

  return fullPath;
}

async function runCommand(commandSpec: PowerShellCommandSpec, cwd: string, allowDangerousCommands: boolean) {
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
      finishedAt: new Date().toISOString()
    };
  }

  const safeCommand = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;

  try {
    const result = await execFileAsync(safeCommand, args, {
      cwd,
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 20,
      shell: process.platform === "win32",
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
  return join(cwd, ".keynu", "powershell", "backups", timestamp + "-" + safeName);
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

  if (!existsSync(cwd)) {
    throw new Error("cwd does not exist: " + cwd);
  }

  for (const filePath of payload.readFiles ?? []) {
    try {
      const fullPath = safeResolve(cwd, filePath);
      const content = readFileSync(fullPath, "utf8");
      const maxReportChars = 12000;
      const reportContent = content.length > maxReportChars ? content.slice(0, maxReportChars) : content;
      reads.push({
        path: filePath,
        ok: true,
        content: reportMode === "summary" ? undefined : reportContent,
        preview: reportMode === "summary" ? reportContent.slice(0, 800) : undefined,
        bytes: Buffer.byteLength(reportContent),
        truncated: content.length > maxReportChars,
        originalBytes: Buffer.byteLength(content),
      });
    } catch (error: any) {
      reads.push({ path: filePath, ok: false, error: error.message ?? String(error) });
      errors.push("read failed: " + filePath);
    }
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
      writes.push({ path: file.path, ok: true, bytes: Buffer.byteLength(file.content), backup });
    } catch (error: any) {
      writes.push({ path: file.path, ok: false, error: error.message ?? String(error) });
      errors.push("write failed: " + file.path);
    }
  }

  for (const commandSpec of payload.commands ?? []) {
    const result = await runCommand(commandSpec, cwd, allowDangerousCommands);
    commands.push(result);
    if (!result.ok) {
      errors.push("command failed: " + commandSpec.command + " " + (commandSpec.args ?? []).join(" "));
    }
  }

  let build = null;
  if (payload.buildCommand) {
    build = await runCommand(payload.buildCommand, cwd, allowDangerousCommands);
    if (!build.ok) {
      errors.push("build failed: " + payload.buildCommand.command + " " + (payload.buildCommand.args ?? []).join(" "));
    }
  }

  const git = {
    branch: await runCommand({ command: "git", args: ["branch", "--show-current"] }, cwd, true),
    status: await runCommand({ command: "git", args: ["status", "--short"] }, cwd, true),
    diffStat: await runCommand({ command: "git", args: ["diff", "--stat"] }, cwd, true),
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
