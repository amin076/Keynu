import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHandoff, inspectEsbikoTracker, runWatch } from '../esbiko-continuation-watch.mjs';

const tick = String.fromCharCode(96);
const pending = id => '- [ ] ' + tick + id + tick;
const makeTracker = rows => [
  '## Goal',
  'All 32 simulations',
  '## Already browser WebMCP-discoverable in main',
  '- physics.acoustics.doppler',
  '## Not yet browser WebMCP-discoverable in main (26)',
  ...rows,
  '',
  '## Working method',
  'Do not claim ChatGPT control without direct verification.',
].join('\n');

test('selects exactly the first two pending simulations, with accurate browser counts', () => {
  const result = inspectEsbikoTracker(makeTracker([
    pending('physics.mechanics.projectile'),
    pending('physics.electricity.circuits'),
    pending('physics.mechanics.collision'),
  ]));
  assert.equal(result.pending, 3);
  assert.equal(result.browserReady, 29);
  assert.deepEqual(result.nextPair, ['physics.mechanics.projectile', 'physics.electricity.circuits']);
  assert.match(createHandoff(result), /ZERO OpenAI API calls/);
  assert.match(createHandoff(result), /NOT a message to an existing ChatGPT conversation/);
});

test('fails closed on missing tracker section, malformed duplicate pending entries', () => {
  assert.throws(() => inspectEsbikoTracker('## Goal\nNo section'), /missing/);
  assert.throws(() => inspectEsbikoTracker(makeTracker([
    pending('physics.mechanics.projectile'),
    pending('physics.mechanics.projectile'),
  ])), /Duplicate/);
});

test('empty queue does not falsely assert ChatGPT server-MCP readiness', () => {
  const result = inspectEsbikoTracker(makeTracker([]));
  assert.deepEqual(result.nextPair, []);
  assert.equal(result.pending, 0);
  assert.match(createHandoff(result), /Independently verify ChatGPT server-MCP/);
});

test('fixture mode writes deterministic JSON without an API key or network request', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'keynu-esbiko-watch-'));
  try {
    const source = join(dir, 'issue.md');
    const output = join(dir, 'status.json');
    await writeFile(source, makeTracker([pending('physics.waves.surface-waves-double-slit')]), 'utf8');
    const result = await runWatch(['--fixture', source, '--output', output]);
    assert.equal(result.pending, 1);
    const written = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(written.nextPair[0], 'physics.waves.surface-waves-double-slit');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
