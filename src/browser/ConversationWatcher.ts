import { ConversationManager } from "./ConversationManager.js";
import { ConversationMemory } from "./memory/ConversationMemory.js";

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
  private baselineText: string | null = null;

  constructor(
    private readonly conversation: ConversationManager,
    private readonly options: ConversationWatcherOptions =
      defaultConversationWatcherOptions,
  ) {}

  async waitForNewAssistantMessage(): Promise<string> {
    await this.ensureBaseline();

    console.log("[watcher] Waiting for NEW assistant message...");

    while (true) {
      const text = await this.conversation.readLatestAssistantText();

      if (!text || text === this.baselineText) {
        await this.sleep(this.options.pollMs);
        continue;
      }

      const stableText = await this.waitUntilStable(text);

      if (stableText === this.baselineText) {
        await this.sleep(this.options.pollMs);
        continue;
      }

      if (await this.memory.hasSeen(stableText)) {
        this.baselineText = stableText;
        await this.sleep(this.options.pollMs);
        continue;
      }

      this.baselineText = stableText;
      await this.memory.remember(stableText, "READ");

      console.log("[watcher] New stable assistant message detected.");
      return stableText;
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
    if (this.baselineText !== null) {
      return;
    }

    const latest = await this.conversation.readLatestAssistantText();

    this.baselineText = latest ?? "";

    if (latest) {
      console.log("[watcher] Baseline assistant message stored. Waiting for next message.");
    } else {
      console.log("[watcher] No assistant baseline found. Waiting for first assistant message.");
    }
  }

  private async waitUntilStable(initialText: string): Promise<string> {
    let currentText = initialText;
    let stableSince = Date.now();

    while (true) {
      const latest = await this.conversation.readLatestAssistantText();

      if (latest && latest !== currentText) {
        currentText = latest;
        stableSince = Date.now();
      }

      if (Date.now() - stableSince >= this.options.stableMs) {
        return currentText;
      }

      await this.sleep(this.options.pollMs);
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
