import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { assertSafeCommand, assertSafeCwd, assertSafeRelativePath } from "./powershell-safety.js";
import type {
  PowerShellCommandResult,
  PowerShellCommandSpec,
  PowerShellReadFileResult,
  PowerShellReadFileSpec,
  PowerShellWriteFileResult,
  PowerShellWriteFileSpec,
} from "./powershell-types.js";

const execFileAsync = promisify(execFile);

function normalizeCommand(command: string): string {
  if (process.platform === "win32" && command.toLowerCase() === "npm") return "npm.cmd";
  if (process.platform === "win32" && command.toLowerCase() === "npx") return "npx.cmd";
  return command;
}

export async function runPowerShellCommand(
  cwd: string,
  spec: PowerShellCommandSpec,
): Promise<PowerShellCommandResult> {
  assertSafeCwd(cwd);

  const args = spec.args ?? [];
  assertSafeCommand(spec.command, args);

  const startedAt = new Date().toISOString();
  const started = Date.now();
  const safeCommand = normalizeCommand(spec.command);

  try {
    const result = await execFileAsync(safeCommand, args, {
      cwd,
      windowsHide: true,
      timeout: spec.timeoutMs ?? 120000,
      maxBuffer: 1024 * 1024 * 20,
      shell: process.platform === "win32",
    });

    return {
      command: spec.command,
      args,
      ok: true,
      stdout: result.stdout,
      stderr: result.stderr,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    };
  } catch (error: any) {
    return {
      command: spec.command,
      args,
      ok: false,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      error: error.message ?? String(error),
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    };
  }
}

export function readPowerShellFile(cwd: string, spec: PowerShellReadFileSpec): PowerShellReadFileResult {
  try {
    assertSafeCwd(cwd);
    const fullPath = assertSafeRelativePath(cwd, spec.path);

    if (!existsSync(fullPath)) {
      return { path: spec.path, ok: false, error: "File does not exist." };
    }

    const content = readFileSync(fullPath, "utf8");
    const maxBytes = spec.maxBytes ?? 200000;
    const sliced = content.length > maxBytes ? content.slice(0, maxBytes) : content;

    return {
      path: spec.path,
      ok: true,
      content: sliced,
      bytes: Buffer.byteLength(sliced, "utf8"),
      error: content.length > maxBytes ? `Content truncated to ${maxBytes} chars.` : undefined,
    };
  } catch (error: any) {
    return { path: spec.path, ok: false, error: error.message ?? String(error) };
  }
}

export function writePowerShellFile(cwd: string, spec: PowerShellWriteFileSpec): PowerShellWriteFileResult {
  try {
    assertSafeCwd(cwd);
    const fullPath = assertSafeRelativePath(cwd, spec.path);

    if (existsSync(fullPath) && spec.overwrite === false) {
      return { path: spec.path, ok: false, error: "File already exists and overwrite=false." };
    }

    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, spec.content, "utf8");

    return {
      path: spec.path,
      ok: true,
      bytes: Buffer.byteLength(spec.content, "utf8"),
    };
  } catch (error: any) {
    return { path: spec.path, ok: false, error: error.message ?? String(error) };
  }
}

export function listPowerShellFiles(cwd: string, maxFiles = 200): string[] {
  assertSafeCwd(cwd);

  const ignored = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);
  const files: string[] = [];

  function walk(dir: string): void {
    if (files.length >= maxFiles) return;

    for (const name of readdirSync(dir)) {
      if (ignored.has(name)) continue;
      const full = join(dir, name);
      const rel = relative(cwd, full);
      const stat = statSync(full);

      if (stat.isDirectory()) walk(full);
      else files.push(rel);

      if (files.length >= maxFiles) return;
    }
  }

  walk(cwd);
  return files;
}

export async function collectGitSnapshot(cwd: string) {
  return {
    branch: await runPowerShellCommand(cwd, { command: "git", args: ["branch", "--show-current"] }),
    status: await runPowerShellCommand(cwd, { command: "git", args: ["status", "--short"] }),
    diffStat: await runPowerShellCommand(cwd, { command: "git", args: ["diff", "--stat"] }),
  };
}
