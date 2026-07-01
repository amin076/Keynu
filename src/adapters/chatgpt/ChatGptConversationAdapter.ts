import type { Page } from "playwright";
import type { ConversationAdapter } from "../conversation/ConversationAdapter.js";
import type { ConversationMessage } from "../conversation/ConversationMessage.js";
import { defaultChatGptConfig, type ChatGptConfig } from "./ChatGptConfig.js";
import { ChatGptGenerationDetector } from "./ChatGptGenerationDetector.js";
import { ChatGptMessageReader } from "./ChatGptMessageReader.js";

export class ChatGptConversationAdapter implements ConversationAdapter {
  private readonly messageReader: ChatGptMessageReader;
  private readonly generationDetector: ChatGptGenerationDetector;

  constructor(
    private readonly page: Page,
    private readonly config: ChatGptConfig = defaultChatGptConfig,
  ) {
    this.messageReader = new ChatGptMessageReader(this.page);
    this.generationDetector = new ChatGptGenerationDetector(
      this.page,
      this.messageReader,
    );
  }

  async connect(): Promise<void> {
    await this.page.goto(this.config.conversationUrl, {
      waitUntil: "domcontentloaded",
    });
  }

  async readLatestAssistantMessage(): Promise<ConversationMessage | null> {
    return this.messageReader.readLatestAssistantMessage();
  }

  async waitUntilGenerationFinished(): Promise<void> {
    await this.generationDetector.waitUntilFinished(
      this.config.generationStableMs,
    );
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