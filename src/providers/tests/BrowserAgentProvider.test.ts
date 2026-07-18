import { strict as assert } from 'node:assert';
import { BrowserAgentProvider } from '../browser/BrowserAgentProvider.js';

const startedUrls: string[] = [];
const provider = new BrowserAgentProvider({
  now: () => new Date('2026-07-18T09:00:00.000Z'),
  createApp(conversationUrl) {
    return {
      async start() {
        startedUrls.push(conversationUrl);
      },
    };
  },
});

assert.equal(provider.id, 'browser-agent-chatgpt');
assert.equal(provider.capabilities.transport, 'browser');
assert.equal(provider.capabilities.supportsMissionBootstrap, true);
assert.equal(provider.capabilities.supportsKap, true);
assert.equal(provider.capabilities.supportsContinuation, true);
assert.equal(
  provider.capabilities.capabilities.includes('conversation.watch'),
  true,
);

const session = provider.createSession({
  id: 'session-chatgpt',
  conversationUrl: 'https://chatgpt.com/c/build-week',
  missionProjectId: 'keynu',
  missionId: 'openai-build-week',
});

assert.equal(session.providerId, 'browser-agent-chatgpt');
assert.equal(session.status, 'created');

const result = await provider.start({
  session,
  task: {
    id: 'task-start-chatgpt',
    type: 'start-session',
    missionProjectId: 'keynu',
    missionId: 'openai-build-week',
  },
});

assert.equal(result.providerId, 'browser-agent-chatgpt');
assert.equal(result.taskId, 'task-start-chatgpt');
assert.equal(result.status, 'accepted');
assert.equal(result.session?.status, 'active');
assert.equal(result.session?.startedAt, '2026-07-18T09:00:00.000Z');
assert.deepEqual(startedUrls, ['https://chatgpt.com/c/build-week']);

const missingUrl = await provider.start({
  session: provider.createSession({
    id: 'session-missing-url',
  }),
});

assert.equal(missingUrl.status, 'failed');
assert.match(missingUrl.error ?? '', /conversationUrl/);
assert.deepEqual(startedUrls, ['https://chatgpt.com/c/build-week']);

console.log('BrowserAgentProvider tests passed.');
