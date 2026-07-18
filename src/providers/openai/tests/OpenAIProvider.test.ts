import { strict as assert } from 'node:assert';
import { ProviderRegistry } from '../../ProviderRegistry.js';
import { OpenAIProvider } from '../OpenAIProvider.js';
import type { OpenAIFetch } from '../OpenAITransport.js';

const fetchMock: OpenAIFetch = async () => new Response(JSON.stringify({
  id: 'resp_provider',
  model: 'gpt-test',
  status: 'completed',
  output_text: 'Provider response',
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

assert.equal(provider.id, 'openai-api');
assert.equal(provider.name, 'OpenAI API');
assert.equal(provider.capabilities.transport, 'api');
assert.equal(provider.capabilities.capabilities.includes('text.generate'), true);

const registry = new ProviderRegistry();
registry.register(provider);
assert.equal(registry.get('openai-api'), provider);
assert.deepEqual(registry.findByCapability('text.generate'), [provider]);

const session = provider.createSession({
  id: 'session-openai',
  missionProjectId: 'keynu',
  missionId: 'openai-build-week',
});
const start = await provider.start({ session });
assert.equal(start.status, 'accepted');
assert.equal(start.session?.providerId, 'openai-api');

const result = await provider.execute({
  id: 'task-openai',
  type: 'generate-text',
  missionProjectId: 'keynu',
  missionId: 'openai-build-week',
  input: 'Hello',
}, session);

assert.equal(result.status, 'completed');
assert.equal((result.output as { content?: string }).content, 'Provider response');

console.log('OpenAI provider tests passed.');
