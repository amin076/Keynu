import assert from "node:assert/strict";
import { ConversationManager } from "../ConversationManager.js";

type Value<T> = T | (() => T);

class FakeLocator {
  constructor(
    private readonly counts: Value<number>[] = [0],
    private readonly evaluations: Value<boolean>[] = [false],
  ) {}

  last(): FakeLocator {
    return this;
  }

  async count(): Promise<number> {
    const value = this.counts.length > 1 ? this.counts.shift()! : this.counts[0]!;
    return typeof value === "function" ? value() : value;
  }

  async evaluate(..._args: unknown[]): Promise<boolean> {
    const value =
      this.evaluations.length > 1
        ? this.evaluations.shift()!
        : this.evaluations[0]!;
    return typeof value === "function" ? value() : value;
  }
}

interface HarnessOptions {
  composerEmpty?: boolean[];
  messageCounts?: number[];
  buttonCounts?: number[];
  buttonBusy?: boolean[];
}

function createHarness(options: HarnessOptions = {}) {
  const input = new FakeLocator([1], options.composerEmpty ?? [false]);
  const messages = new FakeLocator(options.messageCounts ?? [0], [false]);
  const button = new FakeLocator(
    options.buttonCounts ?? [0],
    options.buttonBusy ?? [false],
  );

  let now = 0;
  const page = {
    locator(selector: string): FakeLocator {
      return selector === "[data-message-author-role]" ? messages : button;
    },
    async waitForTimeout(milliseconds: number): Promise<void> {
      now += milliseconds;
    },
  };

  const manager = Object.create(ConversationManager.prototype) as ConversationManager;
  Object.assign(manager as object, { page });

  return { manager, input, getNow: () => now };
}

async function invokeConfirmation(
  manager: ConversationManager,
  input: FakeLocator,
  baseline: number,
): Promise<void> {
  const internal = manager as unknown as {
    confirmMessageSubmitted(input: FakeLocator, baseline: number): Promise<void>;
  };
  await internal.confirmMessageSubmitted(input, baseline);
}

async function withFakeClock<T>(
  getNow: () => number,
  operation: () => Promise<T>,
): Promise<T> {
  const originalNow = Date.now;
  Date.now = getNow;
  try {
    return await operation();
  } finally {
    Date.now = originalNow;
  }
}

async function composerEmptyCase(): Promise<void> {
  const harness = createHarness({ composerEmpty: [true] });
  await withFakeClock(harness.getNow, () =>
    invokeConfirmation(harness.manager, harness.input, 4),
  );
  assert.equal(harness.getNow(), 0);
}

async function messageCountCase(): Promise<void> {
  const harness = createHarness({
    composerEmpty: [false],
    messageCounts: [5],
  });
  await withFakeClock(harness.getNow, () =>
    invokeConfirmation(harness.manager, harness.input, 4),
  );
  assert.equal(harness.getNow(), 0);
}

async function busyToReadyCase(): Promise<void> {
  const harness = createHarness({
    composerEmpty: [false, false],
    messageCounts: [4, 4],
    buttonCounts: [1, 1],
    buttonBusy: [true, false],
  });
  await withFakeClock(harness.getNow, () =>
    invokeConfirmation(harness.manager, harness.input, 4),
  );
  assert.equal(harness.getNow(), 200);
}

async function timeoutCase(): Promise<void> {
  const harness = createHarness({
    composerEmpty: [false],
    messageCounts: [4],
    buttonCounts: [0],
  });

  await assert.rejects(
    () =>
      withFakeClock(harness.getNow, () =>
        invokeConfirmation(harness.manager, harness.input, 4),
      ),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "ChatGPT message submission could not be confirmed.",
  );

  assert.equal(harness.getNow(), 12000);
}

interface SendMessageHarnessOptions {
  baselineCount?: number;
  countError?: Error;
}

function createSendMessageHarness(options: SendMessageHarnessOptions = {}) {
  const events: string[] = [];
  const insertedMessages: string[] = [];
  const forwardedBaselines: number[] = [];
  let inputClicks = 0;
  let stateValue = "initial";

  const input = {
    async click(options: { force: boolean }): Promise<void> {
      assert.deepEqual(options, { force: true });
      inputClicks += 1;
      events.push("input-click");
    },
  };

  const messageLocator = {
    async count(): Promise<number> {
      events.push("baseline-count");
      if (options.countError) {
        throw options.countError;
      }
      return options.baselineCount ?? 0;
    },
  };

  const page = {
    locator(selector: string): typeof messageLocator {
      assert.equal(selector, "[data-message-author-role]");
      events.push("baseline-locator");
      return messageLocator;
    },
    keyboard: {
      async insertText(message: string): Promise<void> {
        insertedMessages.push(message);
        events.push("insert-text");
      },
    },
    async waitForTimeout(milliseconds: number): Promise<void> {
      assert.equal(milliseconds, 300);
      events.push("typing-delay");
    },
  };

  const manager = Object.create(ConversationManager.prototype) as ConversationManager;
  Object.assign(manager as object, {
    page,
    state: stateValue,
    async getMessageInput() {
      events.push("get-input");
      return input;
    },
    async submitMessage(receivedInput: typeof input) {
      assert.equal(receivedInput, input);
      events.push("submit-message");
    },
    async confirmMessageSubmitted(
      receivedInput: typeof input,
      baseline: number,
    ) {
      assert.equal(receivedInput, input);
      forwardedBaselines.push(baseline);
      events.push("confirm-message");
    },
  });

  return {
    manager,
    events,
    insertedMessages,
    forwardedBaselines,
    getInputClicks: () => inputClicks,
    getState: () => (manager as unknown as { state: string }).state,
  };
}

async function sendMessageCapturedBaselineCase(): Promise<void> {
  const harness = createSendMessageHarness({ baselineCount: 7 });

  await harness.manager.sendMessage("KAP regression payload");

  assert.equal(harness.getInputClicks(), 1);
  assert.deepEqual(harness.insertedMessages, ["KAP regression payload"]);
  assert.deepEqual(harness.forwardedBaselines, [7]);
  assert.equal(harness.getState(), "ready");
  assert.deepEqual(harness.events, [
    "get-input",
    "baseline-locator",
    "baseline-count",
    "input-click",
    "insert-text",
    "typing-delay",
    "submit-message",
    "confirm-message",
  ]);
}

async function sendMessageBaselineFallbackCase(): Promise<void> {
  const harness = createSendMessageHarness({
    countError: new Error("simulated locator failure"),
  });

  await harness.manager.sendMessage("fallback payload");

  assert.deepEqual(harness.insertedMessages, ["fallback payload"]);
  assert.deepEqual(harness.forwardedBaselines, [0]);
  assert.equal(harness.getState(), "ready");
  assert.deepEqual(harness.events, [
    "get-input",
    "baseline-locator",
    "baseline-count",
    "input-click",
    "insert-text",
    "typing-delay",
    "submit-message",
    "confirm-message",
  ]);
}

async function run(): Promise<void> {
  await composerEmptyCase();
  await messageCountCase();
  await busyToReadyCase();
  await timeoutCase();
  await sendMessageCapturedBaselineCase();
  await sendMessageBaselineFallbackCase();
  console.log("ConversationManager submission-confirmation regression tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
