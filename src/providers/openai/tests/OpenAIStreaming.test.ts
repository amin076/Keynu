import { strict as assert } from 'node:assert';
import { mapOpenAIStreamEvent } from '../OpenAIStreaming.js';

const started = mapOpenAIStreamEvent(
  'request-stream',
  'openai-api',
  {
    type: 'response.created',
    response: {
      id: 'resp_stream',
    },
  },
);

assert.equal(started?.type, 'started');

const delta = mapOpenAIStreamEvent(
  'request-stream',
  'openai-api',
  {
    type: 'response.output_text.delta',
    delta: 'Hello',
  },
);

assert.equal(delta?.type, 'delta');
assert.equal(delta?.type === 'delta' ? delta.delta : '', 'Hello');

const usage = mapOpenAIStreamEvent(
  'request-stream',
  'openai-api',
  {
    type: 'response.usage',
    usage: {
      input_tokens: 4,
      output_tokens: 6,
    },
  },
);

assert.equal(usage?.type, 'usage');
assert.equal(usage?.type === 'usage' ? usage.usage.promptTokens : 0, 4);

const completed = mapOpenAIStreamEvent(
  'request-stream',
  'openai-api',
  {
    type: 'response.completed',
    response: {
      id: 'resp_stream',
      model: 'gpt-test',
      output_text: 'Done',
    },
  },
);

assert.equal(completed?.type, 'completed');
assert.equal(
  completed?.type === 'completed' ? completed.response.content : '',
  'Done',
);

const failed = mapOpenAIStreamEvent(
  'request-stream',
  'openai-api',
  {
    type: 'response.failed',
    error: {
      code: 'server_error',
      message: 'failed',
    },
  },
);

assert.equal(failed?.type, 'failed');
assert.match(failed?.type === 'failed' ? failed.error.message : '', /failed/);

const cancelled = mapOpenAIStreamEvent(
  'request-stream',
  'openai-api',
  {
    type: 'response.cancelled',
  },
);

assert.equal(cancelled?.type, 'cancelled');

console.log('OpenAI streaming tests passed.');
