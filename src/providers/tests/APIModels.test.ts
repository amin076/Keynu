import { strict as assert } from 'node:assert';
import { normalizeAPIConfig } from '../api/APIConfig.js';
import { createProviderRequest } from '../api/ProviderRequest.js';
import { createProviderResponse } from '../api/ProviderResponse.js';
import { mergeTokenUsage } from '../api/APITokenUsage.js';

const config = normalizeAPIConfig({
  providerId: 'generic-api',
  endpoint: 'https://provider.example/v1',
  model: 'future-model',
  apiKey: 'secret',
  organization: 'org-test',
  project: 'project-test',
  temperature: 0.2,
  topP: 0.9,
  headers: {
    'X-Test': 'true',
  },
});

assert.equal(config.timeoutMs, 30_000);
assert.equal(config.retryCount, 0);
assert.equal(config.stream, false);
assert.equal(config.model, 'future-model');
assert.throws(
  () => normalizeAPIConfig({ providerId: '', endpoint: 'https://example.test' }),
  /provider id/i,
);
assert.throws(
  () => normalizeAPIConfig({ providerId: 'x', endpoint: '' }),
  /endpoint/i,
);

const request = createProviderRequest({
  providerId: 'generic-api',
  missionProjectId: 'keynu',
  missionId: 'openai-build-week',
  model: 'future-model',
  systemPrompt: 'System prompt',
  messages: [
    {
      role: 'user',
      content: 'Hello',
    },
  ],
  parameters: {
    temperature: 0.1,
    topP: 0.8,
    custom: {
      future: true,
    },
  },
});

assert.match(request.id, /provider-request-/);
assert.equal(request.providerId, 'generic-api');
assert.equal(request.messages[0]?.role, 'user');
assert.throws(
  () => createProviderRequest({ providerId: 'generic-api', messages: [] }),
  /messages or a systemPrompt/,
);

const response = createProviderResponse({
  requestId: request.id,
  providerId: 'generic-api',
  model: 'future-model',
  content: 'Hello back',
  finishReason: 'stop',
  usage: {
    promptTokens: 10,
    completionTokens: 5,
    categories: {
      audioTokens: 2,
    },
  },
});

assert.match(response.id, /provider-response-/);
assert.equal(response.requestId, request.id);
assert.equal(response.content, 'Hello back');
assert.equal(typeof response.createdAt, 'string');

assert.deepEqual(
  mergeTokenUsage(
    {
      promptTokens: 10,
      cachedTokens: 3,
      categories: {
        audioTokens: 2,
      },
    },
    {
      completionTokens: 5,
      reasoningTokens: 7,
      categories: {
        audioTokens: 4,
        imageTokens: 9,
      },
    },
  ),
  {
    promptTokens: 10,
    completionTokens: 5,
    cachedTokens: 3,
    reasoningTokens: 7,
    totalTokens: undefined,
    categories: {
      audioTokens: 6,
      imageTokens: 9,
    },
  },
);

console.log('API model tests passed.');
