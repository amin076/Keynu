import { strict as assert } from 'node:assert';
import { normalizeAPIConfig } from '../../api/APIConfig.js';
import { collectStream } from '../../api/APIStreaming.js';
import { createProviderRequest } from '../../api/ProviderRequest.js';
import { OpenAITransport, type OpenAIFetch } from '../OpenAITransport.js';

const requests: Array<{
  url: string;
  init?: RequestInit;
}> = [];

const jsonFetch: OpenAIFetch = async (url, init) => {
  requests.push({ url: String(url), init });
  return new Response(JSON.stringify({
    id: 'resp_transport',
    model: 'gpt-test',
    status: 'completed',
    output_text: 'Transport response',
    usage: {
      input_tokens: 2,
      output_tokens: 3,
      total_tokens: 5,
    },
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

const config = normalizeAPIConfig({
  providerId: 'openai-api',
  endpoint: 'https://api.openai.test/v1/responses',
  apiKey: 'sk-test',
  organization: 'org-test',
  project: 'project-test',
  model: 'gpt-test',
  timeoutMs: 1000,
  retryCount: 0,
  headers: {
    'X-Custom': 'yes',
  },
});
const request = createProviderRequest({
  id: 'request-transport',
  providerId: 'openai-api',
  messages: [
    {
      role: 'user',
      content: 'Hello',
    },
  ],
});
const transport = new OpenAITransport({ fetch: jsonFetch });
const response = await transport.execute(request, {
  config,
  attempt: 1,
});

assert.equal(response.content, 'Transport response');
assert.equal(response.usage?.totalTokens, 5);
assert.equal(requests.length, 1);
assert.equal(requests[0]?.url, 'https://api.openai.test/v1/responses');
assert.equal(requests[0]?.init?.method, 'POST');
assert.equal(
  (requests[0]?.init?.headers as Record<string, string>).Authorization,
  'Bearer sk-test',
);
assert.equal(
  (requests[0]?.init?.headers as Record<string, string>)['OpenAI-Organization'],
  'org-test',
);
assert.equal(
  (requests[0]?.init?.headers as Record<string, string>)['OpenAI-Project'],
  'project-test',
);
assert.equal(
  (requests[0]?.init?.headers as Record<string, string>)['X-Custom'],
  'yes',
);

const body = JSON.parse(String(requests[0]?.init?.body)) as {
  model: string;
  input: Array<{ role: string; content: string }>;
};
assert.equal(body.model, 'gpt-test');
assert.equal(body.input[0]?.role, 'user');

const errorTransport = new OpenAITransport({
  fetch: async () => new Response(JSON.stringify({
    error: {
      message: 'rate limited',
    },
  }), {
    status: 429,
  }),
});

await assert.rejects(
  () => errorTransport.execute(request, { config, attempt: 1 }),
  /rate limited/,
);

const sse = [
  'data: {"type":"response.output_text.delta","delta":"Hi"}',
  '',
  'data: {"type":"response.completed","response":{"id":"resp_stream","output_text":"Hi"}}',
  '',
  'data: [DONE]',
  '',
].join('\n');
const streamTransport = new OpenAITransport({
  fetch: async () => new Response(sse, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
    },
  }),
});
const events = await collectStream(streamTransport.stream(request, {
  config,
  attempt: 1,
}));

assert.deepEqual(
  events.map((event) => event.type),
  ['started', 'delta', 'completed'],
);

console.log('OpenAI transport tests passed.');
