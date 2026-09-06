import { strict as assert } from 'node:assert';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

const repositoryRoot = process.cwd();
const sourceRoot = join(repositoryRoot, 'src');

function collectFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...collectFiles(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

const failures: string[] = [];
const rootFiles = readdirSync(repositoryRoot).filter((entry) => {
  const path = join(repositoryRoot, entry);
  return statSync(path).isFile();
});

for (const name of rootFiles) {
  if (
    /^keynu-.*-test\.txt$/i.test(name) ||
    /^keynu-.*-health-check\.txt$/i.test(name) ||
    name === 'new-job-test.txt'
  ) {
    failures.push(`ad-hoc root smoke marker: ${name}`);
  }
}

const sourceFiles = collectFiles(sourceRoot);
for (const path of sourceFiles) {
  if (path.endsWith('.backup')) {
    failures.push(`source backup file: ${relative(repositoryRoot, path)}`);
  }

  if (!path.endsWith('.ts') || path.endsWith('.d.ts')) continue;

  const directory = dirname(path);
  const stem = basename(path, '.ts');
  const generatedSiblings = [
    `${stem}.js`,
    `${stem}.js.map`,
    `${stem}.d.ts`,
    `${stem}.d.ts.map`,
  ];

  for (const sibling of generatedSiblings) {
    const siblingPath = join(directory, sibling);
    if (existsSync(siblingPath)) {
      failures.push(
        `generated artifact beside TypeScript source: ${relative(repositoryRoot, siblingPath)}`,
      );
    }
  }
}

assert.deepEqual(
  failures,
  [],
  `Repository hygiene violations:\n${failures.join('\n')}`,
);

console.log('Repository hygiene contract verified.');
