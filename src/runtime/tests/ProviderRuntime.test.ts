import { strict as assert } from 'node:assert';
import type { KapEnvelope } from '../../kap/KapEnvelope.js';
import { createProviderResponse } from '../../providers/api/ProviderResponse.js';
import { ProviderRuntime } from '../ProviderRuntime.js';
import { RuntimeDispatcher } from '../RuntimeDispatcher.js';

const runtime = new ProviderRuntime();

const noKap = await runtime.execute(createProviderResponse({
  requestId: 'request-no-kap',
  providerId: 'openai-api',
  content: 'Plain text response.',
}));

assert.equal(noKap.status, 'SKIPPED');
assert.equal(noKap.items.length, 0);
assert.equal(noKap.errors.length, 0);

const invalid = await runtime.execute(createProviderResponse({
  requestId: 'request-invalid-kap',
  providerId: 'openai-api',
  content: '```kap\n{"protocol":"KAP","version":"1.0","type":"JOB","id":"job-invalid"}\n```',
}));

assert.equal(invalid.status, 'FAILED');
assert.equal(invalid.items.length, 0);
assert.equal(invalid.errors.some((error) => error.includes('payload')), true);

const multiple = await runtime.execute(createProviderResponse({
  requestId: 'request-multiple-kap',
  providerId: 'openai-api',
  content: [
    '```kap id="job-runtime"',
    '{"protocol":"KAP","version":"1.0","type":"JOB","id":"job-runtime","payload":{"target":"noop"}}',
    '```',
    '```kap id="error-runtime"',
    '{"protocol":"KAP","version":"1.0","type":"ERROR","id":"error-runtime","payload":{"error":"failed"}}',
    '```',
  ].join('\n'),
}));

assert.equal(multiple.status, 'COMPLETED');
assert.equal(multiple.items.length, 2);
assert.deepEqual(
  multiple.items.map((item) => item.action),
  ['JOB', 'ERROR'],
);
assert.deepEqual(
  multiple.items.map((item) => item.blockId),
  ['job-runtime', 'error-runtime'],
);

const missionAck = await runtime.execute(createProviderResponse({
  requestId: 'request-mission-ack',
  providerId: 'browser-agent-chatgpt',
  content: [
    '```kap',
    JSON.stringify({
      protocol: 'KAP',
      version: '1.0',
      type: 'MISSION_ACK',
      id: 'ack-runtime',
      payload: {
        projectId: 'keynu',
        missionId: 'openai-build-week',
        status: 'ACCEPTED',
      },
    }),
    '```',
  ].join('\n'),
}));

assert.equal(missionAck.status, 'COMPLETED');
assert.equal(missionAck.items.length, 1);
assert.equal(missionAck.items[0]?.action, 'UNHANDLED');
assert.equal(missionAck.items[0]?.envelope.type, 'MISSION_ACK');

const eventOrdering = await runtime.execute(createProviderResponse({
  requestId: 'request-event-ordering',
  providerId: 'openai-api',
  content: '```kap id="ordering-job"\n{"protocol":"KAP","version":"1.0","type":"JOB","id":"ordering-job","payload":{"target":"noop"}}\n```',
}));

assert.deepEqual(
  eventOrdering.events.map((event) => event.type),
  [
    'response.interpreted',
    'kap.detected',
    'kap.validated',
    'dispatch.completed',
    'runtime.completed',
  ],
);

let dispatchCount = 0;
const guardedRuntime = new ProviderRuntime({
  runtimeDispatcher: new RuntimeDispatcher({
    handlers: {
      JOB: (envelope: KapEnvelope) => {
        dispatchCount += 1;
        return {
          status: 'COMPLETED',
          action: 'JOB',
          envelope,
        };
      },
    },
  }),
});
const guardedInvalid = await guardedRuntime.execute(createProviderResponse({
  requestId: 'request-guarded-invalid',
  providerId: 'openai-api',
  content: '```kap\n{"protocol":"KAP","version":"1.0","type":"JOB","id":"job-guarded-invalid"}\n```',
}));

assert.equal(guardedInvalid.status, 'FAILED');
assert.equal(dispatchCount, 0);

console.log('ProviderRuntime tests passed.');
