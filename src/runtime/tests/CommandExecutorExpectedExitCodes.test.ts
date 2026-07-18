import { strict as assert } from 'node:assert';
import { executeCommand } from '../CommandExecutor.js';

const allowed = await executeCommand(
  {
    command: 'git',
    args: ['grep', '-n', 'definitely-not-present-pattern', '--', 'src/runtime/CommandSpec.ts'],
    expectedExitCodes: [0, 1],
  },
  process.cwd(),
);
assert.equal(allowed.ok, true);
assert.equal(allowed.exitCode, 1);
assert.equal(allowed.error, undefined);

const normal = await executeCommand(
  {
    command: 'git',
    args: ['grep', '-n', 'definitely-not-present-pattern', '--', 'src/runtime/CommandSpec.ts'],
  },
  process.cwd(),
);
assert.equal(normal.ok, false);
assert.equal(normal.exitCode, 1);
assert.match(normal.error ?? '', /Command exited with code 1/);

console.log('PASS CommandExecutorExpectedExitCodes');
