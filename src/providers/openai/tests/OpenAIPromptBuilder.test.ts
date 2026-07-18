import { strict as assert } from 'node:assert';
import { normalizeAPIConfig } from '../../api/APIConfig.js';
import { createProviderRequest } from '../../api/ProviderRequest.js';
import { buildOpenAIRequestBody } from '../OpenAIPromptBuilder.js';

const config = normalizeAPIConfig({
  providerId: 'openai-api',
  endpoint: 'https://api.openai.test/v1/responses',
  apiKey: 'sk-test',
  model: 'gpt-test',
  temperature: 0.4,
  topP: 0.8,
  stream: false,
  metadata: {
    maxTokens: 1000,
  },
});
const request = createProviderRequest({
  id: 'request-openai-prompt',
  providerId: 'openai-api',
  model: 'gpt-override',
  systemPrompt: 'System prompt',
  messages: [
    { role: 'system', content: 'System message' },
    { role: 'developer', content: 'Developer message' },
    { role: 'user', content: 'User message' },
    { role: 'assistant', content: 'Assistant message' },
    { role: 'tool', content: [{ type: 'tool-result', data: { ok: true } }] },
    { role: 'future-role', content: 'Future role' },
  ],
  parameters: {
    temperature: 0.1,
    topP: 0.7,
    maxOutputTokens: 200,
    stream: true,
  },
  metadata: {
    missionId: 'openai-build-week',
  },
});

const body = buildOpenAIRequestBody(request, config);

assert.equal(body.model, 'gpt-override');
assert.equal(body.instructions, 'System prompt');
assert.equal(body.temperature, 0.1);
assert.equal(body.top_p, 0.7);
assert.equal(body.max_output_tokens, 200);
assert.equal(body.stream, true);
assert.equal(body.metadata?.missionId, 'openai-build-week');
assert.deepEqual(
  body.input.map((message) => message.role),
  ['system', 'developer', 'user', 'assistant', 'tool', 'future-role'],
);

console.log('OpenAI prompt builder tests passed.');
