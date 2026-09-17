import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { OpenAIProvider } from '../../../providers/openai/OpenAIProvider.js';
import { ApiExecutionAgent } from '../ApiExecutionAgent.js';
import { openAIHttpError } from '../../../providers/openai/OpenAIHttpError.js';

const requests: any[] = [];
const server = createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  const parsed = JSON.parse(body); requests.push(parsed);
  const reviewing = parsed.instructions.includes('separate review pass');
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ id: `response-${requests.length}`, status: 'completed',
    output_text: JSON.stringify(reviewing ? { approved: true, reason: 'Verified', nextSteps: [] }
      : { kind: 'call', name: 'project.read', args: { path: 'README.md' } }) }));
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  const port = (server.address() as { port: number }).port;
  const provider = new OpenAIProvider({ config: { endpoint: `http://127.0.0.1:${port}/v1/responses`, apiKey: 'test-only', model: 'fixture', retryCount: 0 } });
  const agent = new ApiExecutionAgent(provider);
  assert.equal((await agent.decide({ goal: 'Read README' })).kind, 'call');
  assert.equal((await agent.review({ evidence: 'read' })).approved, true);
  assert.equal(requests.length, 2); assert.equal(requests[0].max_output_tokens, 4096);
  assert.ok(!JSON.stringify(requests).includes('test-only'));
  const quota = await openAIHttpError(new Response(JSON.stringify({ error: { code: 'insufficient_quota', message: 'No credits' } }), { status: 429 }));
  assert.equal(quota.category, 'quota'); assert.equal(quota.retryable, false);
  const rate = await openAIHttpError(new Response('{}', { status: 429, headers: { 'retry-after': '12' } }));
  assert.equal(rate.retryable, true); assert.equal(rate.metadata?.retryAfterMs, 12000);
  console.log('API execution: real loopback HTTP worker/reviewer, request shape, quota and Retry-After passed.');
} finally { server.close(); server.closeAllConnections(); }
