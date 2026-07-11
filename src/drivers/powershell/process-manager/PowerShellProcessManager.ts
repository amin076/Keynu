import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  mkdirSync,
  appendFileSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
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

function isPidRunning(pid?: number): boolean {
  if (!pid || !Number.isInteger(pid) || pid <= 0) return false;

  if (process.platform === "win32") {
    const result = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
      encoding: "utf8",
      windowsHide: true,
    });
    return result.status === 0 && result.stdout.includes(`\"${pid}\"`);
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export class PowerShellProcessManager {
  private readonly processes = new Map<string, ChildProcessWithoutNullStreams>();
  private readonly records = new Map<string, ManagedProcessRecord>();
  private registryCwd = process.cwd();

  private getRegistryPath(cwd = this.registryCwd): string {
    return join(resolve(cwd), ".keynu", "processes", "registry.json");
  }

  private loadRecords(cwd = this.registryCwd): void {
    this.registryCwd = resolve(cwd);
    const registryPath = this.getRegistryPath();
    if (!existsSync(registryPath)) return;

    try {
      const parsed = JSON.parse(readFileSync(registryPath, "utf8")) as ManagedProcessRecord[];
      for (const record of parsed) {
        this.records.set(record.id, record);
      }
    } catch {
      // Ignore a damaged registry and recreate it on the next write.
    }
  }

  private saveRecords(): void {
    const registryPath = this.getRegistryPath();
    mkdirSync(dirname(registryPath), { recursive: true });
    writeFileSync(registryPath, JSON.stringify([...this.records.values()], null, 2) + "\n", "utf8");
  }

  private refreshStatuses(): void {
    for (const record of this.records.values()) {
      if (record.status === "RUNNING" && !isPidRunning(record.pid)) {
        record.status = "EXITED";
        record.finishedAt ??= new Date().toISOString();
      }
    }
    this.saveRecords();
  }

  start(options: StartProcessOptions): ManagedProcessRecord {
    this.loadRecords(options.cwd);
    this.refreshStatuses();

    const existing = this.records.get(options.id);
    if (existing?.status === "RUNNING" && isPidRunning(existing.pid)) {
      throw new Error("Process already running: " + options.id);
    }

    const cwd = resolve(options.cwd);
    const args = options.args ?? [];
    const logPath = resolve(options.logPath ?? join(cwd, ".keynu", "processes", options.id + ".log"));
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
    this.saveRecords();

    writeFileSync(logPath, "[keynu] process started: " + options.id + "\n", "utf8");
    child.stdout.on("data", (chunk) => appendFileSync(logPath, chunk));
    child.stderr.on("data", (chunk) => appendFileSync(logPath, chunk));

    child.on("exit", (code) => {
      record.status = "EXITED";
      record.exitCode = code;
      record.finishedAt = new Date().toISOString();
      this.processes.delete(options.id);
      this.saveRecords();
      appendFileSync(logPath, "\n[keynu] process exited with code: " + code + "\n");
    });

    child.on("error", (error) => {
      record.status = "FAILED";
      record.finishedAt = new Date().toISOString();
      this.processes.delete(options.id);
      this.saveRecords();
      appendFileSync(logPath, "\n[keynu] process error: " + error.message + "\n");
    });

    return record;
  }

  list(cwd = process.cwd()): ManagedProcessRecord[] {
    this.loadRecords(cwd);
    this.refreshStatuses();
    return [...this.records.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  stop(id: string, cwd = process.cwd()): ManagedProcessRecord {
    this.loadRecords(cwd);
    this.refreshStatuses();

    const child = this.processes.get(id);
    const record = this.records.get(id);
    if (!record) throw new Error("Unknown process: " + id);
    if (record.status !== "RUNNING") return record;

    if (child) {
      child.kill();
    } else if (record.pid) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(record.pid), "/T", "/F"], { windowsHide: true });
      } else {
        try {
          process.kill(record.pid, "SIGTERM");
        } catch {
          // Process may already have exited.
        }
      }
    }

    record.status = "EXITED";
    record.finishedAt = new Date().toISOString();
    this.processes.delete(id);
    this.saveRecords();
    return record;
  }

  readLog(id: string, maxChars = 4000, cwd = process.cwd()): string {
    this.loadRecords(cwd);
    const record = this.records.get(id);
    if (!record) throw new Error("Unknown process: " + id);
    if (!existsSync(record.logPath)) return "";

    const content = readFileSync(record.logPath, "utf8");
    return content.length > maxChars ? content.slice(-maxChars) : content;
  }
}
