import { strict as assert } from 'node:assert';
import { KapInterpreter } from '../KapInterpreter.js';

const interpreter = new KapInterpreter();

const multiple = interpreter.interpret([
  'before',
  '```kap id="job-one"',
  '{"protocol":"KAP","version":"1.0","type":"JOB","id":"job-one","payload":{"target":"noop"}}',
  '```',
  'middle',
  '```kap id="report-one" extension="future"',
  '{"protocol":"KAP","version":"1.0","type":"REPORT","id":"report-one","payload":{"jobId":"job-one","status":"COMPLETED"}}',
  '```',
].join('\n'));

assert.equal(multiple.blocks.length, 2);
assert.equal(multiple.blocks[0]?.id, 'job-one');
assert.equal(multiple.blocks[0]?.source, 'fenced');
assert.equal((multiple.blocks[0]?.parsed as { type?: string }).type, 'JOB');
assert.equal(multiple.blocks[1]?.id, 'report-one');
assert.equal((multiple.blocks[1]?.parsed as { type?: string }).type, 'REPORT');

const whitespace = interpreter.interpret([
  '   ',
  '```kap',
  '   { "protocol": "KAP", "version": "1.0", "type": "ERROR", "id": "err-one", "payload": { "error": "failed" } }',
  '```',
].join('\n'));

assert.equal(whitespace.blocks.length, 1);
assert.equal((whitespace.blocks[0]?.parsed as { type?: string }).type, 'ERROR');

const bare = interpreter.interpret(
  '{"protocol":"KAP","version":"1.0","type":"JOB","id":"job-bare","payload":{"target":"noop"}}',
);
assert.equal(bare.blocks.length, 1);
assert.equal(bare.blocks[0]?.source, 'balanced-json');

const invalid = interpreter.interpret('```kap\n{not json}\n```');
assert.equal(invalid.blocks.length, 1);
assert.match(invalid.blocks[0]?.parseError ?? '', /JSON/);
assert.equal(invalid.errors.length, 1);

const none = interpreter.interpret('No runtime instruction here.');
assert.equal(none.blocks.length, 0);

console.log('KapInterpreter tests passed.');
