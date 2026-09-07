import assert from "node:assert/strict";
import { ConversationManager } from "../ConversationManager.js";

class FakeUserMessageLocator {
  constructor(
    private readonly totalCount: number,
    private readonly texts: Array<string | null>,
  ) {}

  async count(): Promise<number> {
    return this.totalCount;
  }

  nth(index: number): { textContent(): Promise<string | null> } {
    return {
      textContent: async () => this.texts[index] ?? null,
    };
  }
}

function createConfirmationHarness(
  totalCount: number,
  texts: Array<string | null>,
) {
  let now = 0;
  const userMessages = new FakeUserMessageLocator(totalCount, texts);
  const page = {
    locator(selector: string): FakeUserMessageLocator {
      assert.equal(selector, '[data-message-author-role="user"]');
      return userMessages;
    },
    async waitForTimeout(milliseconds: number): Promise<void> {
      now += milliseconds;
    },
  };

  const manager = Object.create(ConversationManager.prototype) as ConversationManager;
  Object.assign(manager as object, { page });

  return { manager, getNow: () => now };
}

async function invokeConfirmation(
  manager: ConversationManager,
  baseline: number,
  signature: string,
): Promise<void> {
  const internal = manager as unknown as {
    confirmMessageSubmitted(baseline: number, signature: string): Promise<void>;
  };
  await internal.confirmMessageSubmitted(baseline, signature);
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

async function matchingUserMessageConfirmsCase(): Promise<void> {
  const harness = createConfirmationHarness(5, [
    "old-0",
    "old-1",
    "old-2",
    "old-3",
    "terminal report report-job-123 completed",
  ]);

  await withFakeClock(harness.getNow, () =>
    invokeConfirmation(harness.manager, 4, "report-job-123"),
  );

  assert.equal(harness.getNow(), 0);
}

async function unrelatedMessageMustNotFalseConfirmCase(): Promise<void> {
  const harness = createConfirmationHarness(5, [
    "old-0",
    "old-1",
    "old-2",
    "old-3",
    "another unrelated message appeared",
  ]);

  await assert.rejects(
    () =>
      withFakeClock(harness.getNow, () =>
        invokeConfirmation(harness.manager, 4, "report-job-123"),
      ),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(
        "ChatGPT message submission could not be confirmed by a matching user message",
      ),
  );

  assert.equal(harness.getNow(), 12000);
}

async function occupiedComposerIsRejectedCase(): Promise<void> {
  const manager = Object.create(ConversationManager.prototype) as ConversationManager;
  const input = {
    async evaluate(): Promise<string> {
      return "unsent previous Keynu report";
    },
  };

  const internal = manager as unknown as {
    assertComposerEmpty(input: typeof input): Promise<void>;
  };

  await assert.rejects(
    () => internal.assertComposerEmpty(input),
    (error: unknown) =>
      error instanceof Error &&
      error.message ===
        "ChatGPT composer is occupied; Keynu refused to append to or overwrite an existing draft.",
  );
}

async function unreadableComposerFailsClosedCase(): Promise<void> {
  const manager = Object.create(ConversationManager.prototype) as ConversationManager;
  const input = {
    async evaluate(): Promise<string> {
      throw new Error("simulated DOM read failure");
    },
  };

  const internal = manager as unknown as {
    assertComposerEmpty(input: typeof input): Promise<void>;
  };

  await assert.rejects(
    () => internal.assertComposerEmpty(input),
    (error: unknown) =>
      error instanceof Error && error.message === "simulated DOM read failure",
  );
}

async function failedOwnedDraftCanBeCleanedCase(): Promise<void> {
  const manager = Object.create(ConversationManager.prototype) as ConversationManager;
  let cleared = false;
  const input = {
    async evaluate(): Promise<string> {
      return "```kap report-job-123 ```";
    },
    async fill(value: string): Promise<void> {
      assert.equal(value, "");
      cleared = true;
    },
    async click(): Promise<void> {},
  };
  Object.assign(manager as object, {
    page: {
      keyboard: {
        async press(): Promise<void> {},
      },
    },
  });

  const internal = manager as unknown as {
    cleanupOwnedDraft(
      input: typeof input,
      message: string,
      signature: string,
    ): Promise<void>;
  };

  await internal.cleanupOwnedDraft(
    input,
    "```kap\n{\"id\":\"report-job-123\"}\n```",
    "report-job-123",
  );

  assert.equal(cleared, true);
}

async function kapIdIsSubmissionSignatureCase(): Promise<void> {
  const manager = Object.create(ConversationManager.prototype) as ConversationManager;
  const internal = manager as unknown as {
    submissionSignature(message: string): string;
  };

  assert.equal(
    internal.submissionSignature(
      '```kap\n{"protocol":"KAP","id":"report-job-456"}\n```',
    ),
    "report-job-456",
  );
}

async function outboundMessagesAreSerializedCase(): Promise<void> {
  const manager = Object.create(ConversationManager.prototype) as ConversationManager;
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const events: string[] = [];

  Object.assign(manager as object, {
    outboundChain: Promise.resolve(),
    async sendMessageOnce(message: string): Promise<void> {
      events.push(`start:${message}`);
      if (message === "first") {
        await firstGate;
      }
      events.push(`end:${message}`);
    },
  });

  const first = manager.sendMessage("first");
  const second = manager.sendMessage("second");

  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(events, ["start:first"]);

  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, [
    "start:first",
    "end:first",
    "start:second",
    "end:second",
  ]);
}

async function run(): Promise<void> {
  await matchingUserMessageConfirmsCase();
  await unrelatedMessageMustNotFalseConfirmCase();
  await occupiedComposerIsRejectedCase();
  await unreadableComposerFailsClosedCase();
  await failedOwnedDraftCanBeCleanedCase();
  await kapIdIsSubmissionSignatureCase();
  await outboundMessagesAreSerializedCase();
  console.log("ConversationManager submission-confirmation regression tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
