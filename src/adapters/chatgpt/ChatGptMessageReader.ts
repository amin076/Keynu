import type { Page } from "playwright";
import type { ConversationMessage } from "../conversation/ConversationMessage.js";

export class ChatGptMessageReader {
  constructor(private readonly page: Page) {}

  async readLatestAssistantMessage(): Promise<ConversationMessage | null> {
    const assistantMessages = this.page.locator(
      '[data-message-author-role="assistant"]',
    );

    const count = await assistantMessages.count();

    if (count === 0) {
      return null;
    }

    const latest = assistantMessages.nth(count - 1);
    const text = (await latest.innerText()).trim();

    if (!text) {
      return null;
    }

    return {
      id: this.createMessageId(text),
      role: "assistant",
      text,
      createdAt: new Date().toISOString(),
    };
  }

  private createMessageId(text: string): string {
    let hash = 0;

    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }

    return `chatgpt-assistant-${hash.toString(16)}`;
  }
}