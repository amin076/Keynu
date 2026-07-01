import type { Page } from "playwright";
import { ChatGptMessageReader } from "./ChatGptMessageReader.js";

export class ChatGptGenerationDetector {
  constructor(
    private readonly page: Page,
    private readonly messageReader: ChatGptMessageReader,
  ) {}

  async waitUntilFinished(stableMs: number): Promise<void> {
    let lastText = "";
    let stableSince = Date.now();

    while (true) {
      const message = await this.messageReader.readLatestAssistantMessage();
      const currentText = message?.text ?? "";

      if (currentText !== lastText) {
        lastText = currentText;
        stableSince = Date.now();
      }

      if (Date.now() - stableSince >= stableMs) {
        return;
      }

      await this.page.waitForTimeout(300);
    }
  }
}