import { access, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { executeFileSystemRequest } from "../drivers/filesystem/filesystem-runtime-adapter.js";
import type { FileSystemAction } from "../drivers/filesystem/filesystem-types.js";
import { executeCommand } from "../runtime/CommandExecutor.js";
import type { CommandExecutionResult } from "../runtime/CommandExecutionResult.js";
import type { CommandSpec } from "../runtime/CommandSpec.js";
import type {
  EngineeringAction,
  EngineeringOperationResult,
  EngineeringPayload,
} from "./EngineeringTypes.js";

type EngineeringFileSystemAction = Extract<EngineeringAction, `fs.${string}`>;

const FILESYSTEM_ACTIONS: Record<EngineeringFileSystemAction, FileSystemAction> = {
  "fs.readFile": "readFile",
  "fs.writeFile": "writeFile",
  "fs.createFolder": "createFolder",
  "fs.listDirectory": "listDirectory",
  "fs.exists": "exists",
};

const BLOCKED_ENGINEERING_COMMANDS = new Set([
  "format",
  "shutdown",
  "restart-computer",
  "reboot",
  "poweroff",
]);

function isFilesystemAction(action: EngineeringAction): action is EngineeringFileSystemAction {
  return action in FILESYSTEM_ACTIONS;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function validateBranchName(value: string): string {
  const branch = requireString(value, "branch");
  if (
    branch.startsWith("-") ||
    branch.startsWith("/") ||
    branch.endsWith("/") ||
    branch.includes("..") ||
    branch.includes("//") ||
    !/^[A-Za-z0-9._/-]+$/.test(branch)
  ) {
    throw new Error(`Unsafe or invalid Git branch name: ${branch}`);
  }
  return branch;
}

function validateRelativePath(value: string): string {
  const path = requireString(value, "path");
  if (path.startsWith("-")) {
    throw new Error(`Unsafe Git pathspec: ${path}`);
  }
  return path;
}

export class EngineeringRuntime {
  async execute(
    action: EngineeringAction,
    payload: EngineeringPayload,
  ): Promise<EngineeringOperationResult> {
    const projectRoot = await this.resolveProjectRoot(payload.projectRoot);

    if (isFilesystemAction(action)) {
      return await this.executeFilesystem(action, projectRoot, payload);
    }

    switch (action) {
      case "command.run":
        return await this.runCommand(projectRoot, payload);
      case "script.run":
        return await this.runScript(projectRoot, payload);
      case "git.status":
        return await this.runGitRead(action, projectRoot, ["status", "--short", "--branch"]);
      case "git.currentBranch":
        return await this.runGitRead(action, projectRoot, ["branch", "--show-current"]);
      case "git.diff": {
        const args = ["diff"];
        if (payload.staged) args.push("--cached");
        if (payload.path) args.push("--", validateRelativePath(payload.path));
        return await this.runGitRead(action, projectRoot, args);
      }
      case "git.log": {
        const limit = Math.max(1, Math.min(100, Math.floor(payload.limit ?? 10)));
        return await this.runGitRead(action, projectRoot, [
          "log",
          `-${limit}`,
          "--pretty=format:%H%x09%h%x09%an%x09%aI%x09%s",
        ]);
      }
      case "git.createBranch": {
        const branch = validateBranchName(requireString(payload.branch, "branch"));
        return await this.runGitMutation(action, projectRoot, ["switch", "-c", branch], [`branch:${branch}`]);
      }
      case "git.switchBranch": {
        const branch = validateBranchName(requireString(payload.branch, "branch"));
        return await this.runGitMutation(action, projectRoot, ["switch", branch], [`branch:${branch}`]);
      }
      case "git.stage": {
        const paths = payload.paths?.map(validateRelativePath) ?? [];
        if (paths.length === 0) {
          throw new Error("git.stage requires at least one path.");
        }
        return await this.runGitMutation(action, projectRoot, ["add", "--", ...paths], paths);
      }
      case "git.commit": {
        const message = requireString(payload.message, "message");
        return await this.runGitMutation(action, projectRoot, ["commit", "-m", message], ["git-commit"]);
      }
      case "project.verify":
        return await this.verifyProject(projectRoot, payload.commands ?? []);
      default:
        throw new Error(`Unsupported Engineering Runtime action: ${action}`);
    }
  }

  private async resolveProjectRoot(projectRootInput: string): Promise<string> {
    const projectRoot = resolve(requireString(projectRootInput, "projectRoot"));
    await access(projectRoot);
    const info = await stat(projectRoot);
    if (!info.isDirectory()) {
      throw new Error(`projectRoot is not a directory: ${projectRoot}`);
    }
    return projectRoot;
  }

  private resolveProjectCwd(projectRoot: string, cwdInput?: string): string {
    if (!cwdInput) return projectRoot;
    const cwd = isAbsolute(cwdInput) ? resolve(cwdInput) : resolve(projectRoot, cwdInput);
    const rel = relative(projectRoot, cwd);
    if (
      rel === ".." ||
      rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
      isAbsolute(rel)
    ) {
      throw new Error("Command cwd is outside the approved project root.");
    }
    return cwd;
  }

  private async executeFilesystem(
    action: EngineeringFileSystemAction,
    projectRoot: string,
    payload: EngineeringPayload,
  ): Promise<EngineeringOperationResult> {
    const path = requireString(payload.path, "path");
    const result = await executeFileSystemRequest(projectRoot, {
      action: FILESYSTEM_ACTIONS[action],
      path,
      content: payload.content,
    });
    return {
      action,
      projectRoot,
      success: true,
      summary: result.summary,
      data: result.data,
      changed: result.changed,
    };
  }

  private async runCommand(
    projectRoot: string,
    payload: EngineeringPayload,
  ): Promise<EngineeringOperationResult> {
    const spec = payload.command;
    if (!spec) throw new Error("command.run requires payload.command.");
    this.assertEngineeringCommandAllowed(spec);
    const normalized: CommandSpec = {
      ...spec,
      cwd: this.resolveProjectCwd(projectRoot, spec.cwd),
    };
    const result = await executeCommand(normalized, projectRoot);
    return {
      action: "command.run",
      projectRoot,
      success: result.ok,
      summary: result.ok ? "Command completed successfully." : result.error ?? "Command failed.",
      data: result,
      commandResults: [result],
    };
  }

  private async runScript(
    projectRoot: string,
    payload: EngineeringPayload,
  ): Promise<EngineeringOperationResult> {
    const runtime = payload.runtime;
    const script = requireString(payload.script, "script");
    if (!runtime) throw new Error("script.run requires runtime.");
    const spec: CommandSpec = {
      command: "script",
      runtime,
      script,
      args: payload.args,
      timeoutMs: payload.timeoutMs,
      cwd: projectRoot,
    };
    const result = await executeCommand(spec, projectRoot);
    return {
      action: "script.run",
      projectRoot,
      success: result.ok,
      summary: result.ok
        ? `${runtime} script completed successfully.`
        : result.error ?? `${runtime} script failed.`,
      data: result,
      commandResults: [result],
    };
  }

  private assertEngineeringCommandAllowed(spec: CommandSpec): void {
    const command = spec.command.trim().toLowerCase();
    if (BLOCKED_ENGINEERING_COMMANDS.has(command)) {
      throw new Error(`Engineering Runtime blocks system-level command: ${spec.command}`);
    }
    if (command === "git") {
      const args = spec.args ?? [];
      const normalized = args.map((arg) => arg.toLowerCase());
      const joined = normalized.join(" ");
      if (
        joined.includes("reset --hard") ||
        normalized.includes("clean") ||
        normalized.includes("--force") ||
        (normalized.includes("-f") && normalized.includes("push"))
      ) {
        throw new Error(
          "Engineering Runtime blocks destructive Git command; use an explicitly governed path instead.",
        );
      }
    }
  }

  private async runGitRead(
    action: EngineeringAction,
    projectRoot: string,
    args: string[],
  ): Promise<EngineeringOperationResult> {
    const result = await this.executeGit(projectRoot, args);
    return {
      action,
      projectRoot,
      success: result.ok,
      summary: result.ok ? `${action} completed.` : result.error ?? `${action} failed.`,
      data: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      },
      commandResults: [result],
    };
  }

  private async runGitMutation(
    action: EngineeringAction,
    projectRoot: string,
    args: string[],
    changed: string[],
  ): Promise<EngineeringOperationResult> {
    const result = await this.executeGit(projectRoot, args);
    return {
      action,
      projectRoot,
      success: result.ok,
      summary: result.ok ? `${action} completed.` : result.error ?? `${action} failed.`,
      data: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      },
      changed: result.ok ? changed : undefined,
      commandResults: [result],
    };
  }

  private async executeGit(projectRoot: string, args: string[]): Promise<CommandExecutionResult> {
    return await executeCommand(
      {
        command: "git",
        args,
        cwd: projectRoot,
        timeoutMs: 60_000,
      },
      projectRoot,
    );
  }

  private async verifyProject(
    projectRoot: string,
    commands: CommandSpec[],
  ): Promise<EngineeringOperationResult> {
    if (commands.length === 0) {
      throw new Error("project.verify requires at least one command.");
    }

    const results: CommandExecutionResult[] = [];
    for (const command of commands) {
      this.assertEngineeringCommandAllowed(command);
      const result = await executeCommand(
        {
          ...command,
          cwd: this.resolveProjectCwd(projectRoot, command.cwd),
        },
        projectRoot,
      );
      results.push(result);
      if (!result.ok && command.runAfterFailure !== true) break;
    }

    const success =
      results.length === commands.length && results.every((result) => result.ok);
    return {
      action: "project.verify",
      projectRoot,
      success,
      summary: success
        ? `Project verification passed (${results.length} command(s)).`
        : `Project verification failed after ${results.length} command(s).`,
      data: {
        attempted: results.length,
        requested: commands.length,
        failed: results.filter((result) => !result.ok).length,
      },
      commandResults: results,
    };
  }
}
