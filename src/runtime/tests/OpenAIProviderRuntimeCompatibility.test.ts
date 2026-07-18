import { strict as assert } from 'node:assert';
import { OpenAIProvider } from '../../providers/openai/OpenAIProvider.js';
import type { OpenAIFetch } from '../../providers/openai/OpenAITransport.js';
import { ProviderRuntime } from '../ProviderRuntime.js';

const fetchMock: OpenAIFetch = async () => new Response(JSON.stringify({
  id: 'resp_openai_runtime',
  model: 'gpt-test',
  status: 'completed',
  output_text: [
    '```kap',
    JSON.stringify({
      protocol: 'KAP',
      version: '1.0',
      type: 'JOB',
      id: 'job-openai-runtime',
      payload: {
        target: 'noop',
      },
    }),
    '```',
  ].join('\n'),
}), {
  status: 200,
});

const provider = new OpenAIProvider({
  config: {
    apiKey: 'sk-test',
    model: 'gpt-test',
    endpoint: 'https://api.openai.test/v1/responses',
    retryCount: 0,
  },
  transportOptions: {
    fetch: fetchMock,
  },
});

const result = await provider.execute({
  id: 'task-openai-runtime',
  type: 'generate-text',
  input: 'Return one KAP JOB.',
});

assert.equal(result.status, 'completed');

const runtime = new ProviderRuntime();
const runtimeResult = await runtime.execute(result.output as never);

assert.equal(runtimeResult.status, 'COMPLETED');
assert.equal(runtimeResult.items.length, 1);
assert.equal(runtimeResult.items[0]?.action, 'JOB');
assert.equal(runtimeResult.items[0]?.envelope.id, 'job-openai-runtime');

console.log('OpenAI ProviderRuntime compatibility tests passed.');
