import type { Page } from "playwright";
import { ConversationLocator } from "./ConversationLocator.js";
import type { BrowserConversationState } from "./ConversationState.js";

export class ConversationManager {
  private state: BrowserConversationState = "idle";
  private readonly locator: ConversationLocator;

  constructor(private readonly page: Page) {
    this.locator = new ConversationLocator(page);
  }

  getState(): BrowserConversationState {
    return this.state;
  }

  async open(url: string): Promise<void> {
    this.state = "opening";

    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
    });

    this.state = "ready";
  }

  async readLatestAssistantText(): Promise<string | null> {
    const messages = this.locator.assistantMessages();
    const count = await messages.count();

    if (count === 0) {
      return null;
    }

    for (let index = count - 1; index >= 0; index -= 1) {
      try {
        const text = (
          await messages.nth(index).innerText({
            timeout: 2000,
          })
        ).trim();

        if (text.length > 0) {
          return text;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  async sendMessage(message: string): Promise<void> {
    const input = this.locator.inputBox();

    await input.fill(message);
    await input.press("Enter");
  }

  async screenshot(path: string): Promise<void> {
    await this.page.screenshot({
      path,
      fullPage: true,
    });
  }
}
