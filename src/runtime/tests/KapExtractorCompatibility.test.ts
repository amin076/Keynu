import { strict as assert } from 'node:assert';
import { extractKapEnvelope } from '../../kap/KapExtractor.js';

const extracted = extractKapEnvelope([
  'before',
  '```kap id="compat-job"',
  '{"protocol":"KAP","version":"1.0","type":"JOB","id":"compat-job","payload":{"target":"noop"}}',
  '```',
  'after',
].join('\n'));

assert.ok(extracted);
assert.equal(extracted.id, 'compat-job');
assert.equal(extracted.type, 'JOB');

const first = extractKapEnvelope([
  '```kap id="first-job"',
  '{"protocol":"KAP","version":"1.0","type":"JOB","id":"first-job","payload":{"target":"noop"}}',
  '```',
  '```kap id="second-error"',
  '{"protocol":"KAP","version":"1.0","type":"ERROR","id":"second-error","payload":{"error":"failed"}}',
  '```',
].join('\n'));

assert.equal(first?.id, 'first-job');
assert.equal(extractKapEnvelope('plain text'), null);
assert.equal(extractKapEnvelope('```kap\n{bad json}\n```'), null);

console.log('KapExtractor compatibility tests passed.');
