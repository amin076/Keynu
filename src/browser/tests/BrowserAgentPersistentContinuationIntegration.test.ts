import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/browser/BrowserAgent.ts', 'utf8');
const communicationCenter = readFileSync(
  'src/kap/JobCommunicationCenter.ts',
  'utf8',
);
const persistentStore = readFileSync(
  'src/runtime/PersistentJobStore.ts',
  'utf8',
);

assert.match(
  source,
  /PersistentJobStore/,
  'BrowserAgent must use the persistent KAP job store.',
);
assert.match(
  source,
  /jobStore\.claim\(kap\.id\)/,
  'Every KAP job must be claimed persistently before execution.',
);
assert.match(
  source,
  /jobStore\.set\(kap\.id, "RUNNING"\)/,
  'Claimed jobs must record RUNNING before side effects execute.',
);
assert.match(
  source,
  /communicationCenter\.deliverTerminalReport\(/,
  'BrowserAgent terminal reports must flow through the central communication center.',
);
assert.match(
  communicationCenter,
  /jobStore\.recordReport\(kap\.id, state, reportText, reportId\)/,
  'Verified report text must be persisted before browser delivery.',
);
assert.match(
  communicationCenter,
  /jobStore\.markReportDelivered\(record\.jobId\)/,
  'Report delivery acknowledgement must be persisted.',
);
assert.match(
  communicationCenter,
  /jobStore\.markReportDeliveryAttempt\(record\.jobId\)/,
  'Each terminal report delivery attempt must be persisted.',
);
assert.match(
  persistentStore,
  /listUndeliveredReports\(\)/,
  'Persistent storage must expose undelivered reports for restart recovery.',
);
assert.match(
  source,
  /communicationCenter\.recoverUndeliveredReports\(\)/,
  'BrowserAgent startup or duplicate handling must recover persisted undelivered reports.',
);
assert.match(
  source,
  /Automatic re-execution is blocked to avoid duplicate side effects/,
  'Interrupted jobs must fail safe rather than silently re-execute.',
);

const continuationCalls = source.match(/await this\.continueAfterReport\(/g) ?? [];
assert.ok(
  continuationCalls.length >= 4,
  'Continuation must cover routed success/failure, generic runtime results, duplicate replay, and exception recovery paths.',
);

const genericRuntimeIndex = source.indexOf('const task = kapJobToTask(kap)');
const genericContinuationIndex = source.indexOf(
  'await this.continueAfterReport(',
  genericRuntimeIndex,
);
assert.ok(genericRuntimeIndex >= 0);
assert.ok(
  genericContinuationIndex > genericRuntimeIndex,
  'Generic driver/runtime jobs must continue the mission after their report.',
);

const routedDeliveryIndex = source.indexOf(
  'communicationCenter.deliverTerminalReport(',
);
const routedContinuationIndex = source.indexOf(
  'await this.continueAfterReport(',
  routedDeliveryIndex,
);
assert.ok(routedDeliveryIndex >= 0);
assert.ok(
  routedContinuationIndex > routedDeliveryIndex,
  'AI continuation must only be requested after terminal report delivery is attempted.',
);

console.log('BrowserAgentPersistentContinuationIntegration.test passed');
