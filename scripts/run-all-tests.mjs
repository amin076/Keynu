import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['dist/src', 'dist/scripts'];
const skippedNameFragments = [
  '.live.',
  '.manual.',
  '.browser-live.',
];

function collectTests(root) {
  if (!existsSync(root)) return [];
  const found = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      found.push(...collectTests(path));
      continue;
    }
    if (!entry.endsWith('.test.js')) continue;
    if (skippedNameFragments.some((fragment) => entry.includes(fragment))) continue;
    found.push(path);
  }
  return found;
}

const tests = roots.flatMap(collectTests).sort();
if (tests.length === 0) {
  console.error('No compiled Keynu tests were discovered.');
  process.exit(1);
}

console.log(`Discovered ${tests.length} compiled Keynu test files.`);
const failures = [];
for (const test of tests) {
  const label = relative(process.cwd(), test);
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [test], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    failures.push({ test: label, status: result.status ?? 1 });
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} Keynu test file(s) failed:`);
  for (const failure of failures) {
    console.error(`- ${failure.test} (exit ${failure.status})`);
  }
  process.exit(1);
}

console.log(`\nAll ${tests.length} Keynu test files passed.`);
