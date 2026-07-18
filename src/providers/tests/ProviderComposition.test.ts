import { strict as assert } from 'node:assert';
import type { AIProvider } from '../AIProvider.js';
import { createProviderComposition } from '../ProviderComposition.js';
import type { ProviderSession } from '../ProviderSession.js';

const openAIProvider: AIProvider = {
  id: 'openai-api',
  name: 'OpenAI API',
  capabilities: {
    transport: 'api',
    capabilities: ['text.generate'],
    supportsMissionBootstrap: false,
    supportsKap: false,
    supportsContinuation: false,
    supportsInteractiveSession: false,
  },
  createSession(input: Partial<ProviderSession> = {}): ProviderSession {
    return {
      id: input.id ?? 'openai-session',
      providerId: 'openai-api',
      status: input.status ?? 'created',
    };
  },
  async start() {
    return {
      providerId: 'openai-api',
      taskId: 'start-openai',
      status: 'accepted',
    };
  },
};

const withoutOpenAI = await createProviderComposition({
  env: {},
});

assert.equal(withoutOpenAI.registry.has('browser-agent-chatgpt'), true);
assert.equal(withoutOpenAI.registry.has('openai-api'), false);
assert.equal(
  withoutOpenAI.diagnostics.some((diagnostic) =>
    diagnostic.providerId === 'openai-api' &&
    diagnostic.status === 'skipped'
  ),
  true,
);

const withOpenAI = await createProviderComposition({
  env: {
    OPENAI_API_KEY: 'sk-composition-secret-1234',
    OPENAI_MODEL: 'gpt-test',
  },
  openAIProviderFactory: () => openAIProvider,
});

assert.equal(withOpenAI.registry.has('browser-agent-chatgpt'), true);
assert.equal(withOpenAI.registry.get('openai-api'), openAIProvider);
assert.equal(
  withOpenAI.diagnostics.some((diagnostic) =>
    diagnostic.providerId === 'openai-api' &&
    diagnostic.status === 'registered'
  ),
  true,
);

const invalidOpenAI = await createProviderComposition({
  env: {
    OPENAI_API_KEY: 'sk-composition-secret-1234',
    OPENAI_MODEL: 'gpt-test',
  },
  openAIProviderFactory: () => null,
});

assert.equal(invalidOpenAI.registry.has('browser-agent-chatgpt'), true);
assert.equal(invalidOpenAI.registry.has('openai-api'), false);
assert.equal(
  invalidOpenAI.diagnostics.some((diagnostic) =>
    diagnostic.providerId === 'openai-api' &&
    diagnostic.status === 'invalid'
  ),
  true,
);

const throwingOpenAI = await createProviderComposition({
  env: {
    OPENAI_API_KEY: 'sk-composition-secret-1234',
    OPENAI_MODEL: 'gpt-test',
  },
  openAIProviderFactory: () => {
    throw new Error('failure with sk-composition-secret-1234');
  },
});

assert.equal(throwingOpenAI.registry.has('browser-agent-chatgpt'), true);
assert.equal(throwingOpenAI.registry.has('openai-api'), false);
assert.equal(
  throwingOpenAI.diagnostics.map((diagnostic) => diagnostic.message).join('\n')
    .includes('sk-composition-secret-1234'),
  false,
);
assert.match(
  throwingOpenAI.diagnostics.map((diagnostic) => diagnostic.message).join('\n'),
  /<redacted-openai-api-key>/,
);

console.log('Provider composition tests passed.');
