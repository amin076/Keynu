// Trusted Esbiko verification adapter. Receives a path to JSON arguments.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const approved = new Set(['build', 'lint', 'sim:check', 'test:platform-api', 'test:webmcp']);
if (!approved.has(args.script)) throw new Error('Esbiko verification script is not approved.');

const npmCli = process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli)) {
  throw new Error('Launch Keynu with npm run mission so npm_execpath is available.');
}
const result = spawnSync(process.execPath, [npmCli, 'run', args.script], {
  cwd: process.cwd(),
  encoding: 'utf8',
  timeout: 600000,
  maxBuffer: 4 * 1024 * 1024,
});
console.log(JSON.stringify({
  script: args.script,
  exitCode: result.status,
  stdoutTail: result.stdout?.slice(-16000),
  stderrTail: result.stderr?.slice(-6000),
  error: result.error?.message,
}));
process.exit(result.status === 0 && !result.error ? 0 : 1);
