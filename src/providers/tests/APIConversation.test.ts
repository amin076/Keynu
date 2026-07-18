import { strict as assert } from 'node:assert';
import { APIConversation } from '../api/APIConversation.js';
import { createAPIMessage } from '../api/APIMessage.js';

const conversation = new APIConversation('conversation-api-test', {
  missionId: 'openai-build-week',
});

conversation.system('System prompt');
conversation.developer('Developer guidance');
conversation.user('User message');
conversation.assistant('Assistant response');
conversation.tool([{ type: 'tool-result', data: { ok: true } }]);
conversation.add('future-role', 'Future provider role');
conversation.addMessage(createAPIMessage('user', 'Manual message', {
  id: 'message-manual',
}));

const snapshot = conversation.snapshot();

assert.equal(snapshot.id, 'conversation-api-test');
assert.equal(snapshot.metadata?.missionId, 'openai-build-week');
assert.deepEqual(
  snapshot.messages.map((message) => message.role),
  ['system', 'developer', 'user', 'assistant', 'tool', 'future-role', 'user'],
);
assert.equal(snapshot.messages[0]?.content, 'System prompt');
assert.equal(snapshot.messages[6]?.id, 'message-manual');
assert.equal(typeof snapshot.messages[0]?.createdAt, 'string');

const messages = conversation.getMessages();
messages[0]!.role = 'mutated';
assert.equal(conversation.getMessages()[0]?.role, 'system');

console.log('APIConversation tests passed.');
