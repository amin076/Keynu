import { strict as assert } from 'node:assert';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { executeCommand } from '../CommandExecutor.js';

const cwd = process.cwd();
const scriptsDirectory = join(cwd, '.keynu', 'runtime', 'scripts');

const result = await executeCommand(
  {
    command: 'script',
    runtime: 'node',
    cleanup: true,
    timeoutMs: 10000,
    script: [
      "import { mkdir, writeFile } from 'node:fs/promises';",
      "import { join } from 'node:path';",
      "const directory = join(process.cwd(), '.keynu', 'tests');",
      "await mkdir(directory, { recursive: true });",
      "await writeFile(join(directory, 'script-command-direct-e2e.json'), JSON.stringify({ status: 'COMPLETED', runtime: 'node' }, null, 2), 'utf8');",
      "console.log('keynu-script-command-direct-e2e');",
    ].join('\n'),
  },
  cwd,
);

assert.equal(result.ok, true);
assert.match(result.stdout || '', /keynu-script-command-direct-e2e/);

const remainingScripts = await readdir(scriptsDirectory).catch(() => []);
assert.equal(
  remainingScripts.filter((name) => /\.(mjs|ps1|py|sh)$/i.test(name)).length,
  0,
);

const invalidRuntimeError = await executeCommand(
  {
    command: 'script',
    runtime: 'invalid' as never,
    script: "console.log('must-not-run')",
  },
  cwd,
).then(
  () => null,
  (error: unknown) => error,
);

assert.ok(invalidRuntimeError instanceof Error);
assert.match(invalidRuntimeError.message, /runtime/i);

console.log('ScriptCommand.test passed');
