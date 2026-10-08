import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TRACKER_URL = 'https://github.com/amin076/science-web-lab/issues/122';
export const TRACKER_API = 'https://api.github.com/repos/amin076/science-web-lab/issues/122';
const TOTAL = 32;

export function inspectEsbikoTracker(body) {
  if (typeof body !== 'string') throw new Error('Tracker body must be text.');
  const header = /^## Not yet browser WebMCP-discoverable in main[^\n]*$/m;
  const match = header.exec(body);
  if (!match) throw new Error('Tracker pending section is missing; fail closed.');
  const tail = body.slice(match.index + match[0].length);
  const section = tail.split(/\n##\s/)[0];
  const ids = [...section.matchAll(/^\s*-\s*\[\s\]\s*\x60([a-z0-9.-]+)\x60/gm)]
    .map(item => item[1]);
  if (ids.length !== new Set(ids).size) throw new Error('Duplicate pending simulation.');
  if (ids.length > TOTAL) throw new Error('Pending count exceeds registry baseline.');
  // These are BROWSER WebMCP coverage figures, not end-to-end ChatGPT readiness.
  return {
    total: TOTAL,
    browserReady: TOTAL - ids.length,
    pending: ids.length,
    nextPair: ids.slice(0, 2),
    remaining: ids,
    trackerUrl: TRACKER_URL,
  };
}

export function createHandoff(data) {
  const pair = data.nextPair;
  return [
    '## Esbiko continuation queue (monitor-only)',
    '',
    'Browser WebMCP coverage: ' + data.browserReady + '/' + data.total +
      '; pending: ' + data.pending + '.',
    'Next pair: ' + (pair.length ? pair.join(' + ') : 'none listed') + '.',
    '',
    pair.length
      ? 'Proposed next step: upgrade exactly this pair, including live state and validated tools, stage-first mobile UI, real 16:9 and 9:16 WebM recording, browser/build/MCP tests and PR evidence.'
      : 'No pending browser-WebMCP entries remain in the tracker. Independently verify ChatGPT server-MCP control before closing the overall project.',
    '',
    'Tracker: ' + data.trackerUrl,
    '',
    'Important: this is an automated GitHub handoff, NOT a message to an existing ChatGPT conversation.',
    'This monitor makes ZERO OpenAI API calls and neither edits simulations nor launches a paid coding agent.',
    'Do not mark an item complete until its changes, tests, and deployment are verified.',
  ].join('\n');
}

export async function getTrackerBody(options = {}) {
  if (options.fixture) return readFile(options.fixture, 'utf8');
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'keynu-esbiko-continuation-watch',
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(TRACKER_API, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('GitHub tracker HTTP ' + response.status);
  const issue = await response.json();
  if (issue.state !== 'open' || typeof issue.body !== 'string') {
    throw new Error('Tracker is not an open issue with a text body.');
  }
  return issue.body;
}

export async function runWatch(args = process.argv.slice(2)) {
  const flagValue = flag => {
    const position = args.indexOf(flag);
    if (position < 0) return undefined;
    if (!args[position + 1] || args[position + 1].startsWith('--')) {
      throw new Error('Missing value for ' + flag);
    }
    return args[position + 1];
  };
  const fixture = flagValue('--fixture');
  const output = flagValue('--output');
  const body = await getTrackerBody({ fixture });
  const report = inspectEsbikoTracker(body);
  const result = { ...report, issueBody: createHandoff(report) };
  const serialized = JSON.stringify(result, null, 2) + '\n';
  if (output) await writeFile(resolve(output), serialized, 'utf8');
  else process.stdout.write(serialized);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runWatch().catch(error => {
    console.error('Esbiko watch blocked: ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
