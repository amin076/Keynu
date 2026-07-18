import { mkdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

export type ScriptRuntime = 'node' | 'powershell' | 'python' | 'bash';

export type TemporaryScript = {
  runtime: ScriptRuntime;
  scriptFile: string;
  cleanup: boolean;
};

const SCRIPT_EXTENSIONS: Record<ScriptRuntime, string> = {
  node: '.mjs',
  powershell: '.ps1',
  python: '.py',
  bash: '.sh',
};

export function isScriptRuntime(value: unknown): value is ScriptRuntime {
  return (
    value === 'node' ||
    value === 'powershell' ||
    value === 'python' ||
    value === 'bash'
  );
}

export async function createTemporaryScript(
  runtime: ScriptRuntime,
  script: string,
  cwd: string,
  cleanup = true,
): Promise<TemporaryScript> {
  if (typeof script !== 'string' || script.trim().length === 0) {
    throw new Error('Script source must be a non-empty string.');
  }

  const directory = join(cwd, '.keynu', 'runtime', 'scripts');
  await mkdir(directory, { recursive: true });

  const scriptFile = join(
    directory,
    `${randomUUID()}${SCRIPT_EXTENSIONS[runtime]}`,
  );

  await writeFile(scriptFile, script, 'utf8');

  return { runtime, scriptFile, cleanup };
}

export async function removeTemporaryScript(
  temporaryScript: TemporaryScript,
): Promise<void> {
  if (!temporaryScript.cleanup) return;
  await rm(temporaryScript.scriptFile, { force: true });
}
