import type { Page } from "playwright";
import { defaultBrowserConfig, type BrowserConfig } from "./BrowserConfig.js";
import { BrowserSession } from "./BrowserSession.js";
import { ConversationManager } from "./ConversationManager.js";
import { ConversationWatcher } from "./ConversationWatcher.js";

export class BrowserDriver {
  readonly name = "browser";

  private readonly session: BrowserSession;
  private conversation: ConversationManager | null = null;
  private watcher: ConversationWatcher | null = null;

  constructor(private readonly config: BrowserConfig = defaultBrowserConfig) {
    this.session = new BrowserSession(config);
  }

  async initialize(): Promise<void> {
    const page = await this.session.start();

    this.conversation = new ConversationManager(page);
    this.watcher = new ConversationWatcher(this.conversation);

    if (this.config.dedicatedConversationUrl) {
      await this.conversation.open(this.config.dedicatedConversationUrl);
    }
  }

  getPage(): Page {
    return this.session.getPage();
  }

  getConversation(): ConversationManager {
    if (!this.conversation) {
      throw new Error("Browser conversation has not been initialized.");
    }

    return this.conversation;
  }

  getWatcher(): ConversationWatcher {
    if (!this.watcher) {
      throw new Error("Browser watcher has not been initialized.");
    }

    return this.watcher;
  }

  async shutdown(): Promise<void> {
    await this.session.stop();
    this.conversation = null;
    this.watcher = null;
  }
}
