import { strict as assert } from 'node:assert';
import {
  createOpenAIAPIConfig,
  DEFAULT_OPENAI_ENDPOINT,
} from '../OpenAIConfiguration.js';
import { createOpenAIAuthenticationHeaders } from '../OpenAIAuthentication.js';

const config = createOpenAIAPIConfig({
  apiKey: 'sk-test',
  organization: 'org-test',
  project: 'project-test',
  model: 'gpt-test',
  timeoutMs: 10_000,
  retryCount: 2,
  temperature: 0.2,
  topP: 0.9,
  maxTokens: 500,
  stream: true,
  headers: {
    'X-Test': 'true',
  },
});

assert.equal(config.providerId, 'openai-api');
assert.equal(config.endpoint, DEFAULT_OPENAI_ENDPOINT);
assert.equal(config.model, 'gpt-test');
assert.equal(config.metadata?.maxTokens, 500);

const headers = createOpenAIAuthenticationHeaders({
  ...config,
  timeoutMs: 10_000,
  retryCount: 2,
  stream: true,
});

assert.equal(headers.Authorization, 'Bearer sk-test');
assert.equal(headers['OpenAI-Organization'], 'org-test');
assert.equal(headers['OpenAI-Project'], 'project-test');
assert.throws(
  () => createOpenAIAPIConfig({ apiKey: '', model: 'gpt-test' }),
  /apiKey/,
);
assert.throws(
  () => createOpenAIAPIConfig({ apiKey: 'sk-test', model: '' }),
  /model/,
);

console.log('OpenAI configuration tests passed.');
