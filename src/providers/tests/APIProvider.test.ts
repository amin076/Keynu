import { strict as assert } from 'node:assert';
import { APIProvider } from '../api/APIProvider.js';
import { APIProviderError } from '../api/APIError.js';
import { collectStream, type APIStreamEvent } from '../api/APIStreaming.js';
import type { APILogEntry, TransportAdapter } from '../api/APITransport.js';
import { createProviderRequest } from '../api/ProviderRequest.js';
import { createProviderResponse } from '../api/ProviderResponse.js';

const logs: APILogEntry[] = [];
const executeAttemptsByRequest = new Map<string, number>();
let cancelledRequestId: string | undefined;

const transport: TransportAdapter = {
  id: 'fake-rest-transport',
  async execute(request, context) {
    const executeAttempts =
      (executeAttemptsByRequest.get(request.id) ?? 0) + 1;
    executeAttemptsByRequest.set(request.id, executeAttempts);
    assert.equal(context.config.endpoint, 'https://provider.example/api');
    assert.equal(context.config.model, 'generic-model');
    assert.equal(context.attempt, executeAttempts);
    assert.equal(context.signal?.aborted, false);

    if (executeAttempts === 1) {
      throw new APIProviderError({
        category: 'rate_limit',
        message: 'Retry later',
        retryable: true,
        statusCode: 429,
      });
    }

    return createProviderResponse({
      id: 'response-api-provider',
      requestId: request.id,
      providerId: request.providerId,
      model: request.model,
      content: 'Generic response',
      usage: {
        promptTokens: 4,
        completionTokens: 6,
      },
    });
  },
  async *stream(request): AsyncIterable<APIStreamEvent> {
    yield {
      type: 'started',
      requestId: request.id,
      providerId: request.providerId,
    };
    yield {
      type: 'delta',
      requestId: request.id,
      delta: 'streamed',
    };
    yield {
      type: 'completed',
      requestId: request.id,
      response: createProviderResponse({
        requestId: request.id,
        providerId: request.providerId,
        content: 'streamed',
      }),
    };
  },
  async cancel(requestId) {
    cancelledRequestId = requestId;
  },
};

const provider = new APIProvider({
  config: {
    providerId: 'generic-api',
    providerName: 'Generic API',
    endpoint: 'https://provider.example/api',
    model: 'generic-model',
    retryCount: 1,
    timeoutMs: 1000,
    stream: true,
    temperature: 0.3,
    topP: 0.8,
  },
  transport,
  log(entry) {
    logs.push(entry);
  },
  now: () => new Date('2026-07-18T10:00:00.000Z'),
});

assert.equal(provider.id, 'generic-api');
assert.equal(provider.name, 'Generic API');
assert.equal(provider.capabilities.transport, 'api');

const session = provider.createSession({
  id: 'session-api',
  missionProjectId: 'keynu',
  missionId: 'openai-build-week',
});
const start = await provider.start({ session });
assert.equal(start.status, 'accepted');
assert.equal(start.session?.status, 'active');
assert.equal(start.session?.startedAt, '2026-07-18T10:00:00.000Z');

const request = createProviderRequest({
  id: 'request-api-provider',
  providerId: 'generic-api',
  model: 'generic-model',
  messages: [
    {
      role: 'user',
      content: 'Hello',
    },
  ],
});
const response = await provider.executeRequest(request);

assert.equal(response.content, 'Generic response');
assert.equal(response.usage?.promptTokens, 4);
assert.equal(executeAttemptsByRequest.get(request.id), 2);
assert.deepEqual(
  logs.map((entry) =>
    entry.type === 'response'
      ? `${entry.type}:${entry.status}:${entry.attempt}`
      : `${entry.type}:request:${entry.attempt}`,
  ),
  [
    'request:request:1',
    'response:failed:1',
    'request:request:2',
    'response:completed:2',
  ],
);

const result = await provider.execute({
  id: 'task-generate',
  type: 'generate-text',
  missionProjectId: 'keynu',
  missionId: 'openai-build-week',
  input: 'Task input',
});

assert.equal(result.status, 'completed');
assert.equal(result.metadata?.model, 'generic-model');

const streamEvents = await collectStream(provider.streamRequest(request));
assert.deepEqual(
  streamEvents.map((event) => event.type),
  ['started', 'delta', 'completed'],
);

await provider.cancel('request-api-provider', 'test complete');
assert.equal(cancelledRequestId, 'request-api-provider');

console.log('APIProvider tests passed.');
