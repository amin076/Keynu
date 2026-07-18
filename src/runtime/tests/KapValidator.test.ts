import { strict as assert } from 'node:assert';
import { KapInterpreter } from '../KapInterpreter.js';
import { KapValidator } from '../KapValidator.js';

const interpreter = new KapInterpreter();
const validator = new KapValidator();

function blockFor(json: unknown) {
  const text = `\`\`\`kap\n${JSON.stringify(json)}\n\`\`\``;
  const block = interpreter.interpret(text).blocks[0];
  assert.ok(block);
  return block;
}

const valid = validator.validate(blockFor({
  protocol: 'KAP',
  version: '1.0',
  type: 'JOB',
  id: 'job-valid',
  payload: {
    target: 'noop',
  },
}));

assert.equal(valid.valid, true);
if (valid.valid) {
  assert.equal(valid.value.envelope.type, 'JOB');
}

const missing = validator.validate(blockFor({
  protocol: 'KAP',
  version: '1.0',
  type: 'JOB',
  id: 'job-missing-payload',
}));

assert.equal(missing.valid, false);
if (!missing.valid) {
  assert.equal(missing.errors.some((error) => error.field === 'payload'), true);
}

const invalidProtocol = validator.validate(blockFor({
  protocol: 'BAD',
  version: '1.0',
  type: 'JOB',
  id: 'job-bad-protocol',
  payload: {
    target: 'noop',
  },
}));

assert.equal(invalidProtocol.valid, false);
if (!invalidProtocol.valid) {
  assert.equal(
    invalidProtocol.errors.some((error) => error.field === 'protocol'),
    true,
  );
}

const invalidVersion = validator.validate(blockFor({
  protocol: 'KAP',
  version: '2.0',
  type: 'JOB',
  id: 'job-bad-version',
  payload: {
    target: 'noop',
  },
}));

assert.equal(invalidVersion.valid, false);
if (!invalidVersion.valid) {
  assert.equal(
    invalidVersion.errors.some((error) => error.field === 'version'),
    true,
  );
}

const invalidType = validator.validate(blockFor({
  protocol: 'KAP',
  version: '1.0',
  type: 'UNKNOWN',
  id: 'job-bad-type',
  payload: {
    target: 'noop',
  },
}));

assert.equal(invalidType.valid, false);
if (!invalidType.valid) {
  assert.equal(invalidType.errors.some((error) => error.field === 'type'), true);
}

console.log('KapValidator tests passed.');
