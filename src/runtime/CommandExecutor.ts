import { spawn } from 'node:child_process';
import type { CommandSpec } from './CommandSpec.js';
import type { CommandExecutionResult } from './CommandExecutionResult.js';
import { validateCommandSafety } from './CommandSafety.js';
import { createTemporaryScript, isScriptRuntime, removeTemporaryScript } from './ScriptRunner.js';

function normalizeWindowsCommand(command: string): string {
  if (process.platform !== 'win32') return command;
  const lowered = command.toLowerCase();
  if (lowered === 'npm') return 'npm.cmd';
  if (lowered === 'npx') return 'npx.cmd';
  return command;
}

function requiresWindowsShell(command: string): boolean {
  if (process.platform !== 'win32') return false;
  const lowered = command.toLowerCase();
  return lowered.endsWith('.cmd') || lowered.endsWith('.bat');
}

export async function executeCommand(
  spec: CommandSpec,
  defaultCwd: string,
): Promise<CommandExecutionResult> {
  if (spec.command === 'script') {
    if (!isScriptRuntime(spec.runtime)) {
      throw new Error(
        'Script command requires runtime: node, powershell, python, or bash.',
      );
    }

    if (typeof spec.script !== 'string' || spec.script.trim().length === 0) {
      throw new Error('Script command requires non-empty script source.');
    }

    const cwd = spec.cwd || defaultCwd;
    const temporaryScript = await createTemporaryScript(
      spec.runtime,
      spec.script,
      cwd,
      spec.cleanup !== false,
    );

    const runtimeCommand =
      spec.runtime === 'powershell'
        ? {
            command: 'powershell',
            args: [
              '-NoProfile',
              '-ExecutionPolicy',
              'Bypass',
              '-File',
              temporaryScript.scriptFile,
              ...(spec.args || []),
            ],
          }
        : {
            command: spec.runtime,
            args: [temporaryScript.scriptFile, ...(spec.args || [])],
          };

    try {
      return await executeCommand(
        {
          command: runtimeCommand.command,
          args: runtimeCommand.args,
          cwd,
          timeoutMs: spec.timeoutMs,
          runAfterFailure: spec.runAfterFailure,
        },
        defaultCwd,
      );
    } finally {
      await removeTemporaryScript(temporaryScript);
    }
  }
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const cwd = spec.cwd ?? defaultCwd;
  const args = spec.args ?? [];
  const expectedExitCodes = spec.expectedExitCodes?.length
    ? spec.expectedExitCodes
    : [0];
  const safety = validateCommandSafety(spec);

  if (!safety.ok) {
    const finishedAtMs = Date.now();
    return {
      command: spec.command,
      args,
      cwd,
      ok: false,
      stdout: '',
      stderr: '',
      error: safety.reason,
      startedAt,
      finishedAt: new Date(finishedAtMs).toISOString(),
      durationMs: finishedAtMs - startedAtMs,
    };
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const finish = (
      ok: boolean,
      error?: string,
      exitCode?: number | null,
    ) => {
      if (settled) return;
      settled = true;

      if (timeoutHandle) clearTimeout(timeoutHandle);

      const finishedAtMs = Date.now();
      resolve({
        command: spec.command,
        args,
        cwd,
        ok,
        exitCode,
        stdout,
        stderr,
        error,
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        durationMs: finishedAtMs - startedAtMs,
      });
    };

    try {
      const command = normalizeWindowsCommand(spec.command);
      const child = spawn(command, args, {
        cwd,
        shell: requiresWindowsShell(command),
        windowsHide: true,
        windowsVerbatimArguments: false,
      });

      if (typeof spec.timeoutMs === 'number' && spec.timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          child.kill();
          finish(false, `Command timed out after ${spec.timeoutMs} ms`);
        }, spec.timeoutMs);
      }

      child.stdout?.on('data', (chunk) => {
        stdout += String(chunk);
      });

      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk);
      });

      child.on('error', (error) => finish(false, error.message));

      child.on('close', (code) => {
        const ok = expectedExitCodes.includes(code ?? -1);
        finish(
          ok,
          ok ? undefined : `Command exited with code ${code}`,
          code,
        );
      });
    } catch (error) {
      finish(false, error instanceof Error ? error.message : String(error));
    }
  });
}
