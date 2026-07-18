import { ConversationManager } from "./ConversationManager.js";
import type { AssistantMessageSnapshot } from "./AssistantMessageSnapshot.js";
import { ConversationMemory } from "./memory/ConversationMemory.js";
import { browserEventBus } from "./BrowserEventBus.js";
import { BrowserEvents } from "./BrowserEvents.js";

export type ConversationWatcherOptions = {
  pollMs: number;
  stableMs: number;
};

export const defaultConversationWatcherOptions: ConversationWatcherOptions = {
  pollMs: 500,
  stableMs: 1500,
};

function isRecoverableBrowserNavigationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("Execution context was destroyed") ||
    message.includes("Cannot find context with specified id") ||
    message.includes("Most likely the page has been closed") ||
    message.includes("Target page, context or browser has been closed") ||
    message.includes("Navigation")
  );
}

export class ConversationWatcher {
  private readonly memory = new ConversationMemory();
  private baselineMessage: AssistantMessageSnapshot | null = null;

  constructor(
    private readonly conversation: ConversationManager,
    private readonly options: ConversationWatcherOptions = defaultConversationWatcherOptions,
  ) {}

  async waitForNewAssistantMessage(): Promise<string> {
    await this.ensureBaseline();
    console.log("[watcher] Waiting for NEW assistant message...");

    while (true) {
      let stableMessage: AssistantMessageSnapshot;

      try {
        stableMessage = await this.conversation.waitForStableAssistantMessage(
          this.baselineMessage?.id ?? null,
          this.options.stableMs,
        );
      } catch (error) {
        if (!isRecoverableBrowserNavigationError(error)) {
          throw error;
        }

        console.warn(
          "[watcher] Browser navigation replaced the execution context. Retrying...",
        );

        await this.sleep(Math.max(this.options.pollMs, 1000));
        continue;
      }

      if (stableMessage.id === this.baselineMessage?.id) {
        await this.sleep(this.options.pollMs);
        continue;
      }

      this.baselineMessage = stableMessage;

      if (await this.memory.hasSeen(stableMessage.text)) {
        await this.sleep(this.options.pollMs);
        continue;
      }

      await this.memory.remember(stableMessage.text, "READ");
      await browserEventBus.emit(BrowserEvents.MESSAGE_DETECTED,{message:stableMessage,occurredAt:new Date().toISOString()});
      console.log(`[watcher] New assistant message detected: ${stableMessage.id}`);
      return stableMessage.text;
    }
  }

  async markExecuted(text: string): Promise<void> {
    await this.memory.remember(text, "EXECUTED");
  }

  async markFailed(text: string): Promise<void> {
    await this.memory.remember(text, "FAILED");
  }

  async markReported(text: string): Promise<void> {
    await this.memory.remember(text, "REPORTED");
  }

  private async ensureBaseline(): Promise<void> {
    if (this.baselineMessage !== null) return;

    this.baselineMessage = await this.conversation.readLatestAssistantMessage();

    console.log(
      this.baselineMessage
        ? `[watcher] Baseline stored: ${this.baselineMessage.id}`
        : "[watcher] No assistant baseline found. Waiting for first assistant message.",
    );
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }


    async seedBaseline(): Promise<void> {
    const latest = await this.conversation.readLatestAssistantMessage();

    if (!latest) {
      console.log('[watcher] No assistant baseline found before bootstrap.');
      return;
    }

    this.memory.remember(latest.id);
    console.log(
      `[watcher] Seeded assistant baseline before bootstrap: ${latest.id}`,
    );
  }
}
