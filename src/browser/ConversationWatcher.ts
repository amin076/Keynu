import { ConversationManager } from "./ConversationManager.js";

export type ConversationWatcherOptions = {
  pollMs: number;
  stableMs: number;
};

export const defaultConversationWatcherOptions: ConversationWatcherOptions = {
  pollMs: 500,
  stableMs: 1500,
};

export class ConversationWatcher {
  private lastText = "";
  private lastSeenText = "";

  constructor(
    private readonly conversation: ConversationManager,
    private readonly options: ConversationWatcherOptions =
      defaultConversationWatcherOptions,
  ) {}

  async waitForNewAssistantMessage(): Promise<string> {
    while (true) {
      const text = await this.conversation.readLatestAssistantText();

      if (text && text !== this.lastSeenText) {
        const stableText = await this.waitUntilStable(text);

        this.lastSeenText = stableText;
        return stableText;
      }

      await this.sleep(this.options.pollMs);
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
        this.lastText = currentText;
        return currentText;
      }

      await this.sleep(this.options.pollMs);
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
