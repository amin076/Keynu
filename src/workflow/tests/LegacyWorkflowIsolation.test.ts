import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const sourceRoot = join(process.cwd(), 'src');
const legacyWorkflowRoot = join(sourceRoot, 'workflow');

function collectTypeScriptFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...collectTypeScriptFiles(path));
      continue;
    }
    if (entry.endsWith('.ts')) {
      files.push(path);
    }
  }

  return files;
}

function isInsideLegacyWorkflow(path: string): boolean {
  return path === legacyWorkflowRoot || path.startsWith(`${legacyWorkflowRoot}/`) || path.startsWith(`${legacyWorkflowRoot}\\`);
}

const legacySymbols = [
  'WorkflowContinuationService',
  'WorkflowController',
  'WorkflowEventBridge',
  'WorkflowJobGenerator',
];

const unexpectedReferences: string[] = [];
for (const path of collectTypeScriptFiles(sourceRoot)) {
  if (isInsideLegacyWorkflow(path)) continue;

  const source = readFileSync(path, 'utf8');
  const matchedSymbols = legacySymbols.filter((symbol) => source.includes(symbol));
  const importsWorkflowModule = /from\s+['"][^'"]*workflow\//.test(source);

  if (matchedSymbols.length > 0 || importsWorkflowModule) {
    unexpectedReferences.push(
      `${relative(process.cwd(), path)}: ${[
        ...matchedSymbols,
        ...(importsWorkflowModule ? ['workflow/* import'] : []),
      ].join(', ')}`,
    );
  }
}

assert.deepEqual(
  unexpectedReferences,
  [],
  `Legacy workflow continuation escaped its compatibility boundary:\n${unexpectedReferences.join('\n')}`,
);

const browserAgentPath = join(sourceRoot, 'browser', 'BrowserAgent.ts');
const browserAgent = readFileSync(browserAgentPath, 'utf8');

assert.match(
  browserAgent,
  /BrowserContinuationCoordinator/,
  'BrowserAgent must wire the canonical BrowserContinuationCoordinator.',
);
assert.match(
  browserAgent,
  /continuationCoordinator\.continueAfterReport/,
  'Runtime reports must flow through the canonical continuation coordinator.',
);
for (const symbol of legacySymbols) {
  assert.equal(
    browserAgent.includes(symbol),
    false,
    `BrowserAgent must not wire legacy continuation component ${symbol}.`,
  );
}

console.log('Legacy workflow isolation contract verified.');
