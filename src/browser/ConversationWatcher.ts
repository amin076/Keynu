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
      const stableMessage = await this.conversation.waitForStableAssistantMessage(
        this.baselineMessage?.id ?? null,
        this.options.stableMs,
      );

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
}
