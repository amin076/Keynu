import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  'src/browser/BrowserAgent.ts',
  'utf8',
);

assert.match(
  source,
  /BrowserContinuationCoordinator/,
  'BrowserAgent must import the continuation coordinator.',
);
assert.match(
  source,
  /continuationCoordinator\s*=\s*new BrowserContinuationCoordinator/,
  'BrowserAgent must own a continuation coordinator.',
);
assert.match(
  source,
  /continueAfterReport\s*\(/,
  'BrowserAgent must invoke continuation after report delivery.',
);
assert.match(
  source,
  /serializeBrowserReport\(certifiedReport\)/,
  'The verified report must still be delivered normally.',
);
assert.match(
  source,
  /await conversation\.sendMessage\(message\)/,
  'The coordinator must use the active browser conversation sender.',
);
assert.match(
  source,
  /Continuation request result:/,
  'BrowserAgent must log the continuation outcome.',
);

const reportDeliveryIndex = source.indexOf(
  'serializeBrowserReport(certifiedReport)',
);
const continuationIndex = source.indexOf(
  'continueAfterReport(',
  reportDeliveryIndex,
);

assert.ok(reportDeliveryIndex >= 0);
assert.ok(continuationIndex > reportDeliveryIndex);

console.log('BrowserAgentContinuationIntegration.test passed');
