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

  constructor(
    private readonly conversation: ConversationManager,
    private readonly options: ConversationWatcherOptions =
      defaultConversationWatcherOptions,
  ) {}

  async waitForNewAssistantMessage(): Promise<string> {
    while (true) {
      const text = await this.conversation.readLatestAssistantText();

      if (text && !(await this.memory.hasSeen(text))) {
        const stableText = await this.waitUntilStable(text);

        if (!(await this.memory.hasSeen(stableText))) {
          await this.memory.remember(stableText, "READ");
          return stableText;
        }
      }

      await this.sleep(this.options.pollMs);
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
