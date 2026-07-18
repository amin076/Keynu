import { strict as assert } from 'node:assert';
import { runOpenAISmokeTest } from '../runOpenAISmokeTest.js';

const runLive = process.env.KEYNU_RUN_OPENAI_LIVE_TEST === 'true' &&
  Boolean(process.env.OPENAI_API_KEY?.trim());

if (!runLive) {
  console.log('OpenAI live smoke test SKIPPED.');
} else {
  console.log('OpenAI live smoke test may incur API charges.');
  const code = await runOpenAISmokeTest();
  assert.equal(code, 0);
  console.log('OpenAI live smoke test PASSED.');
}
