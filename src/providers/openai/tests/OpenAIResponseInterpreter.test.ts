import { strict as assert } from 'node:assert';
import {
  extractOpenAIText,
  interpretOpenAIResponse,
  interpretOpenAIUsage,
} from '../OpenAIResponseInterpreter.js';

const response = {
  id: 'resp_test',
  object: 'response',
  model: 'gpt-test',
  status: 'completed',
  output: [
    {
      type: 'message',
      content: [
        {
          type: 'output_text',
          text: 'Hello ',
        },
        {
          type: 'output_text',
          text: 'world',
        },
      ],
    },
  ],
  usage: {
    input_tokens: 10,
    output_tokens: 5,
    total_tokens: 15,
    input_tokens_details: {
      cached_tokens: 3,
    },
    output_tokens_details: {
      reasoning_tokens: 2,
    },
  },
};

assert.equal(extractOpenAIText(response), 'Hello world');

const interpreted = interpretOpenAIResponse(
  'request-openai-response',
  'openai-api',
  response,
);

assert.equal(interpreted.id, 'resp_test');
assert.equal(interpreted.requestId, 'request-openai-response');
assert.equal(interpreted.providerId, 'openai-api');
assert.equal(interpreted.model, 'gpt-test');
assert.equal(interpreted.content, 'Hello world');
assert.equal(interpreted.message?.role, 'assistant');
assert.equal(interpreted.finishReason, 'completed');
assert.equal(interpreted.usage?.promptTokens, 10);
assert.equal(interpreted.usage?.completionTokens, 5);
assert.equal(interpreted.usage?.cachedTokens, 3);
assert.equal(interpreted.usage?.reasoningTokens, 2);
assert.equal(interpreted.usage?.totalTokens, 15);

assert.deepEqual(
  interpretOpenAIUsage(response.usage)?.categories,
  {
    input_tokens: 10,
    output_tokens: 5,
    total_tokens: 15,
  },
);

console.log('OpenAI response interpreter tests passed.');
