import { strict as assert } from 'node:assert';
import { RuntimeDispatcher } from '../RuntimeDispatcher.js';
import type { KapEnvelope } from '../../kap/KapEnvelope.js';

const dispatcher = new RuntimeDispatcher();

const job = await dispatcher.dispatch({
  protocol: 'KAP',
  version: '1.0',
  type: 'JOB',
  id: 'job-dispatch',
  payload: {
    target: 'noop',
  },
});
assert.equal(job.status, 'COMPLETED');
assert.equal(job.action, 'JOB');

const report = await dispatcher.dispatch({
  protocol: 'KAP',
  version: '1.0',
  type: 'REPORT',
  id: 'report-dispatch',
  payload: {
    jobId: 'job-dispatch',
    status: 'COMPLETED',
  },
});
assert.equal(report.status, 'COMPLETED');
assert.equal(report.action, 'REPORT');

const error = await dispatcher.dispatch({
  protocol: 'KAP',
  version: '1.0',
  type: 'ERROR',
  id: 'error-dispatch',
  payload: {
    error: 'failed',
  },
});
assert.equal(error.status, 'COMPLETED');
assert.equal(error.action, 'ERROR');

const missionAck = await dispatcher.dispatch({
  protocol: 'KAP',
  version: '1.0',
  type: 'MISSION_ACK',
  id: 'ack-dispatch',
  payload: {
    projectId: 'keynu',
    missionId: 'openai-build-week',
    status: 'ACCEPTED',
  },
} as KapEnvelope);
assert.equal(missionAck.status, 'SKIPPED');
assert.equal(missionAck.action, 'UNHANDLED');
assert.equal(missionAck.envelope.type, 'MISSION_ACK');

const customDispatcher = new RuntimeDispatcher({
  handlers: {
    MISSION_ACK: (envelope) => ({
      status: 'COMPLETED',
      action: 'UNHANDLED',
      envelope,
      message: 'Custom acknowledgement handled.',
    }),
  },
});
const custom = await customDispatcher.dispatch(missionAck.envelope);
assert.equal(custom.status, 'COMPLETED');
assert.equal(custom.message, 'Custom acknowledgement handled.');

console.log('RuntimeDispatcher tests passed.');
