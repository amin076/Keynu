import { strict as assert } from 'node:assert';
import { runOpenAISmokeTest } from '../runOpenAISmokeTest.js';
import type { OpenAIFetch } from '../OpenAITransport.js';

function memoryWriter(): { output: string; write(chunk: string): void } {
  const writer = {
    output: '',
    write(chunk: string): void {
      writer.output += chunk;
    },
  };
  return writer;
}

let capturedRequest: {
  url: string;
  init?: RequestInit;
} | undefined;

const okFetch: OpenAIFetch = async (url, init) => {
  capturedRequest = {
    url: String(url),
    init,
  };
  return new Response(JSON.stringify({
    id: 'resp_smoke',
    model: 'gpt-test',
    status: 'completed',
    output_text: 'OK',
    usage: {
      input_tokens: 4,
      output_tokens: 1,
      total_tokens: 5,
    },
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

const stdout = memoryWriter();
const stderr = memoryWriter();
const passedCode = await runOpenAISmokeTest({
  env: {
    OPENAI_API_KEY: 'sk-smoke-secret-1234',
    OPENAI_MODEL: 'gpt-test',
    OPENAI_BASE_URL: 'https://api.openai.test/v1/responses',
  },
  fetch: okFetch,
  stdout,
  stderr,
});

assert.equal(passedCode, 0);
assert.match(stdout.output, /OpenAI smoke test: PASSED/);
assert.match(stdout.output, /Model: gpt-test/);
assert.match(stdout.output, /Usage: prompt=4, completion=1, total=5/);
assert.match(stdout.output, /Text: OK/);
assert.equal(stdout.output.includes('sk-smoke-secret-1234'), false);
assert.equal(stderr.output, '');
assert.equal(capturedRequest?.url, 'https://api.openai.test/v1/responses');
assert.equal(
  (capturedRequest?.init?.headers as Record<string, string>).Authorization,
  'Bearer sk-smoke-secret-1234',
);

const missingStdout = memoryWriter();
const missingStderr = memoryWriter();
const missingCode = await runOpenAISmokeTest({
  env: {},
  stdout: missingStdout,
  stderr: missingStderr,
});

assert.equal(missingCode, 1);
assert.match(missingStderr.output, /OpenAI smoke test: FAILED \(missing\)/);
assert.match(missingStderr.output, /OPENAI_API_KEY/);

const failedStdout = memoryWriter();
const failedStderr = memoryWriter();
const failedCode = await runOpenAISmokeTest({
  env: {
    OPENAI_API_KEY: 'sk-smoke-secret-1234',
    OPENAI_MODEL: 'gpt-test',
    OPENAI_BASE_URL: 'https://api.openai.test/v1/responses',
  },
  fetch: async () => new Response(JSON.stringify({
    error: {
      message: 'server echoed sk-smoke-secret-1234',
    },
  }), {
    status: 500,
  }),
  stdout: failedStdout,
  stderr: failedStderr,
});

assert.equal(failedCode, 1);
assert.match(failedStderr.output, /OpenAI smoke test: FAILED/);
assert.equal(failedStderr.output.includes('sk-smoke-secret-1234'), false);
assert.match(failedStderr.output, /<redacted-openai-api-key>/);

console.log('OpenAI smoke test CLI tests passed.');
