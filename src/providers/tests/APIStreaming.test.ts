import { strict as assert } from 'node:assert';
import { collectStream, type APIStreamEvent } from '../api/APIStreaming.js';
import { createProviderResponse } from '../api/ProviderResponse.js';

async function* createStream(): AsyncIterable<APIStreamEvent> {
  yield {
    type: 'started',
    requestId: 'request-stream',
    providerId: 'generic-api',
  };
  yield {
    type: 'delta',
    requestId: 'request-stream',
    delta: 'Hello',
  };
  yield {
    type: 'usage',
    requestId: 'request-stream',
    usage: {
      promptTokens: 3,
      completionTokens: 1,
      categories: {
        futureTokens: 2,
      },
    },
  };
  yield {
    type: 'completed',
    requestId: 'request-stream',
    response: createProviderResponse({
      id: 'response-stream',
      requestId: 'request-stream',
      providerId: 'generic-api',
      content: 'Hello',
    }),
  };
}

const events = await collectStream(createStream());

assert.deepEqual(
  events.map((event) => event.type),
  ['started', 'delta', 'usage', 'completed'],
);
assert.equal(events[1]?.type === 'delta' ? events[1].delta : '', 'Hello');
assert.equal(
  events[2]?.type === 'usage'
    ? events[2].usage.categories?.futureTokens
    : undefined,
  2,
);

console.log('API streaming tests passed.');
