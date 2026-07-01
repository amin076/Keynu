import type { Page } from "playwright";
import type { ConversationAdapter } from "../conversation/ConversationAdapter.js";
import type { ConversationMessage } from "../conversation/ConversationMessage.js";
import {
  defaultChatGptConfig,
  type ChatGptConfig,
} from "./ChatGptConfig.js";

export class ChatGptConversationAdapter implements ConversationAdapter {
  constructor(
    private readonly page: Page,
    private readonly config: ChatGptConfig = defaultChatGptConfig,
  ) {}

  async connect(): Promise<void> {
    await this.page.goto(this.config.conversationUrl, {
      waitUntil: "domcontentloaded",
    });
  }

  async readLatestAssistantMessage(): Promise<ConversationMessage | null> {
    return null;
  }

  async waitUntilGenerationFinished(): Promise<void> {
    await this.page.waitForTimeout(this.config.generationStableMs);
  }

  async sendUserMessage(message: string): Promise<void> {
    const textbox = this.page.getByRole("textbox").last();

    await textbox.fill(message);
    await textbox.press("Enter");
  }

  async uploadFiles(_filePaths: string[]): Promise<void> {
    throw new Error("ChatGPT file upload is not implemented yet.");
  }

  async takeScreenshot(outputPath: string): Promise<void> {
    await this.page.screenshot({
      path: outputPath,
      fullPage: true,
    });
  }

  async disconnect(): Promise<void> {
    // Browser session owns lifecycle.
  }
}