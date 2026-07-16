import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/browser/BrowserAgent.ts', 'utf8');

assert.match(
  source,
  /KAP extraction or validation failed/ ,
  'BrowserAgent must detect invalid or missing KAP responses.',
);
assert.match(
  source,
  /Recover after non-KAP assistant response/ ,
  'BrowserAgent must request recovery instead of silently stopping.',
);
assert.match(
  source,
  /await conversation\.sendMessage\(message\)/ ,
  'Non-KAP recovery must deliver the continuation request through the active conversation.',
);
assert.match(
  source,
  /await watcher\.markFailed\(messageText\)/ ,
  'The invalid assistant message must still be marked as failed.',
);

console.log('PASS BrowserAgentNonKapRecovery');
