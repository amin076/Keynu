// Trusted verification function. Receives the path to a JSON arguments file.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const args = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!['build', 'test'].includes(args.script)) throw new Error('Only build/test scripts are approved.');
const npmCli = process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli)) throw new Error('Launch Keynu with npm run mission so npm_execpath is available.');
const result = spawnSync(process.execPath, [npmCli, 'run', args.script], {
  cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 4 * 1024 * 1024,
});
console.log(JSON.stringify({ script: args.script, exitCode: result.status,
  stdoutTail: result.stdout?.slice(-12000), stderrTail: result.stderr?.slice(-4000), error: result.error?.message }));
process.exit(result.status === 0 && !result.error ? 0 : 1);
