import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, appendFileSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type ManagedProcessStatus = "RUNNING" | "EXITED" | "FAILED";

export type ManagedProcessRecord = {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  pid?: number;
  status: ManagedProcessStatus;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
  logPath: string;
};

export type StartProcessOptions = {
  id: string;
  command: string;
  args?: string[];
  cwd: string;
  logPath?: string;
};

function normalizeCommand(command: string): string {
  if (process.platform === "win32" && command.toLowerCase() === "npm") return "npm.cmd";
  if (process.platform === "win32" && command.toLowerCase() === "npx") return "npx.cmd";
  return command;
}

export class PowerShellProcessManager {
  private readonly processes = new Map<string, ChildProcessWithoutNullStreams>();
  private readonly records = new Map<string, ManagedProcessRecord>();

  start(options: StartProcessOptions): ManagedProcessRecord {
    if (this.processes.has(options.id)) {
      throw new Error("Process already running: " + options.id);
    }

    const cwd = resolve(options.cwd);
    const args = options.args ?? [];
    const logPath = options.logPath ?? join(cwd, ".keynu", "processes", options.id + ".log");
    mkdirSync(dirname(logPath), { recursive: true });

    const child = spawn(normalizeCommand(options.command), args, {
      cwd,
      shell: process.platform === "win32",
      windowsHide: true,
    });

    const record: ManagedProcessRecord = {
      id: options.id,
      command: options.command,
      args,
      cwd,
      pid: child.pid,
      status: "RUNNING",
      startedAt: new Date().toISOString(),
      logPath,
    };

    this.processes.set(options.id, child);
    this.records.set(options.id, record);

    writeFileSync(logPath, "[keynu] process started: " + options.id + "\n", "utf8");

    child.stdout.on("data", (chunk) => appendFileSync(logPath, chunk));
    child.stderr.on("data", (chunk) => appendFileSync(logPath, chunk));

    child.on("exit", (code) => {
      record.status = "EXITED";
      record.exitCode = code;
      record.finishedAt = new Date().toISOString();
      this.processes.delete(options.id);
      appendFileSync(logPath, "\n[keynu] process exited with code: " + code + "\n");
    });

    child.on("error", (error) => {
      record.status = "FAILED";
      record.finishedAt = new Date().toISOString();
      this.processes.delete(options.id);
      appendFileSync(logPath, "\n[keynu] process error: " + error.message + "\n");
    });

    return record;
  }

  list(): ManagedProcessRecord[] {
    return [...this.records.values()];
  }

  stop(id: string): ManagedProcessRecord {
    const child = this.processes.get(id);
    const record = this.records.get(id);

    if (!record) throw new Error("Unknown process: " + id);
    if (!child) return record;

    child.kill();
    record.status = "EXITED";
    record.finishedAt = new Date().toISOString();
    this.processes.delete(id);
    return record;
  }

  readLog(id: string, maxChars = 4000): string {
    const record = this.records.get(id);
    if (!record) throw new Error("Unknown process: " + id);
    if (!existsSync(record.logPath)) return "";

    const content = readFileSync(record.logPath, "utf8");
    return content.length > maxChars ? content.slice(-maxChars) : content;
  }
}
