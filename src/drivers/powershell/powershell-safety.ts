import { resolve } from "node:path";

export type PowerShellCommandSpec = {
  command: string;
  args?: string[];
  timeoutMs?: number;
  runAfterFailure?: boolean;
};

const dangerousCommands = new Set([
  "rm",
  "del",
  "rmdir",
  "format",
  "shutdown",
  "restart-computer",
  "remove-item",
]);

export function assertSafeCwd(cwd: string): string {
  if (!cwd || cwd.trim().length === 0) {
    throw new Error("Unsafe cwd: empty");
  }

  return resolve(cwd);
}

export function assertSafeRelativePath(cwd: string, filePath: string): string {
  const root = resolve(cwd);
  const full = resolve(cwd, filePath);

  if (!full.startsWith(root)) {
    throw new Error("Unsafe path outside cwd: " + filePath);
  }

  return full;
}

export function assertSafeCommand(command: string, args: string[] = []): void {
  const normalized = command.toLowerCase();

  if (dangerousCommands.has(normalized)) {
    throw new Error("Blocked dangerous command: " + command);
  }

  const joined = [command, ...args].join(" ").toLowerCase();

  const blockedPatterns = [
    "system32",
    "format ",
    "remove-item -recurse",
    "rm -rf",
    "git push --force",
    "git reset --hard",
  ];

  for (const pattern of blockedPatterns) {
    if (joined.includes(pattern)) {
      throw new Error("Blocked unsafe command pattern: " + pattern);
    }
  }
}

export function checkPowerShellCommandSafety(spec: PowerShellCommandSpec): {
  ok: boolean;
  reason?: string;
} {
  try {
    assertSafeCommand(spec.command, spec.args ?? []);
    return { ok: true };
  } catch (error: any) {
    return {
      ok: false,
      reason: error.message ?? String(error),
    };
  }
}
