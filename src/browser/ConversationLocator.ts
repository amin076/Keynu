import type { Locator, Page } from "playwright";

export class ConversationLocator {
  constructor(private readonly page: Page) {}

  assistantMessages(): Locator {
    return this.page.locator('[data-message-author-role="assistant"]');
  }

  inputBox(): Locator {
    return this.page.getByRole("textbox").last();
  }

  stopButton(): Locator {
    return this.page.getByRole("button", { name: /stop/i }).last();
  }
}
