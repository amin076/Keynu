import { strict as assert } from 'node:assert';
import type { AIProvider } from '../AIProvider.js';
import { ProviderRegistry } from '../ProviderRegistry.js';
import type { ProviderSession } from '../ProviderSession.js';

const provider: AIProvider = {
  id: 'test-provider',
  name: 'Test Provider',
  capabilities: {
    transport: 'api',
    capabilities: ['mission.bootstrap', 'text.generate'],
    supportsMissionBootstrap: true,
    supportsKap: false,
    supportsContinuation: false,
    supportsInteractiveSession: false,
  },
  createSession(input: Partial<ProviderSession> = {}): ProviderSession {
    return {
      id: input.id ?? 'session-test-provider',
      providerId: 'test-provider',
      status: 'created',
    };
  },
  async start() {
    return {
      providerId: 'test-provider',
      taskId: 'task-test-provider',
      status: 'accepted',
    };
  },
};

const registry = new ProviderRegistry();

assert.equal(registry.has('test-provider'), false);
registry.register(provider);
assert.equal(registry.has('test-provider'), true);
assert.equal(registry.get('test-provider'), provider);
assert.deepEqual(registry.list(), [provider]);
assert.deepEqual(registry.findByCapability('mission.bootstrap'), [provider]);
assert.deepEqual(registry.findByCapability('kap.receive'), []);
assert.throws(() => registry.register(provider), /already registered/);
assert.throws(() => registry.get('missing-provider'), /was not found/);

console.log('ProviderRegistry tests passed.');
