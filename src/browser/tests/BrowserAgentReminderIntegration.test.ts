import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { BrowserContinuationReminderService } from '../../mission/BrowserContinuationReminderService.js';

const browserAgentSource = readFileSync('src/browser/BrowserAgent.ts', 'utf8');

assert.ok(
  browserAgentSource.includes('BrowserContinuationReminderService'),
  'BrowserAgent must import the continuation reminder service.',
);
assert.ok(
  browserAgentSource.includes('continuationReminderService: BrowserContinuationReminderService'),
  'BrowserAgent must own a continuation reminder service.',
);
assert.ok(
  browserAgentSource.includes('new BrowserContinuationReminderService('),
  'BrowserAgent must construct the continuation reminder service.',
);
assert.ok(
  browserAgentSource.includes('await this.browser.getConversation().sendMessage(message)'),
  'Reminder delivery must use the active browser conversation.',
);
assert.ok(
  browserAgentSource.includes('continuationReminderService.start('),
  'BrowserAgent must start reminders after report delivery.',
);
assert.ok(
  browserAgentSource.includes('continuationReminderService.cancel('),
  'BrowserAgent must cancel reminders when assistant activity resumes.',
);

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitUntil(
  predicate: () => boolean,
  timeoutMs = 1_000,
): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for reminder state.');
    }
    await sleep(5);
  }
}

const fullChainMessages: string[] = [];
const fullChain = new BrowserContinuationReminderService(
  async (message) => {
    fullChainMessages.push(message);
  },
  { reminderIntervalMs: 20, maxReminders: 3 },
);

fullChain.start();
await waitUntil(() => fullChainMessages.length === 4);
await waitUntil(() => !fullChain.isActive());

assert.equal(fullChain.getReminderCount(), 3);
assert.equal(fullChainMessages.length, 4);
assert.match(fullChainMessages[0], /KEYNU_CONTINUATION_REQUEST/);
assert.match(fullChainMessages[0], /Reminder #1 of 3/);
assert.match(fullChainMessages[1], /Reminder #2 of 3/);
assert.match(fullChainMessages[2], /Reminder #3 of 3/);
assert.match(fullChainMessages[3], /KEYNU_CONTINUATION_REMINDERS_STOPPED/);

const cancelledMessages: string[] = [];
const cancelledChain = new BrowserContinuationReminderService(
  async (message) => {
    cancelledMessages.push(message);
  },
  { reminderIntervalMs: 40, maxReminders: 3 },
);

cancelledChain.start();
await sleep(5);
cancelledChain.cancel();
await sleep(80);

assert.equal(cancelledChain.isActive(), false);
assert.equal(cancelledChain.getReminderCount(), 0);
assert.deepEqual(cancelledMessages, []);

const restartedMessages: string[] = [];
const restartedChain = new BrowserContinuationReminderService(
  async (message) => {
    restartedMessages.push(message);
  },
  { reminderIntervalMs: 25, maxReminders: 1 },
);

restartedChain.start();
await sleep(5);
restartedChain.start();
await waitUntil(() => restartedMessages.length === 2);
await waitUntil(() => !restartedChain.isActive());

assert.equal(restartedChain.getReminderCount(), 1);
assert.equal(restartedMessages.length, 2);
assert.match(restartedMessages[0], /Reminder #1 of 1/);
assert.match(restartedMessages[1], /KEYNU_CONTINUATION_REMINDERS_STOPPED/);

console.log('PASS BrowserAgentReminderIntegration.test');
