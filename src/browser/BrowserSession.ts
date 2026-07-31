import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import type { BrowserConfig } from "./BrowserConfig.js";

export class BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(private readonly config: BrowserConfig) {}

  async start(): Promise<Page> {
    const cdpUrl = process.env.KEYNU_CDP_URL?.trim() || "http://127.0.0.1:9222";
    this.browser = await chromium.connectOverCDP(cdpUrl);

    this.context = this.browser.contexts()[0];

    if (!this.context) {
      throw new Error(
        `No Chrome context found at ${cdpUrl}. Start the browser from the Keynu dashboard or provide KEYNU_CDP_URL.`,
      );
    }

    const dedicatedConversationUrl = this.config.dedicatedConversationUrl?.trim();
    this.page =
      (dedicatedConversationUrl
        ? this.context.pages().find((page) => page.url() === dedicatedConversationUrl)
        : undefined) ??
      this.context
        .pages()
        .find((page) => page.url().startsWith(this.config.defaultUrl)) ??
      this.context.pages()[0] ??
      (await this.context.newPage());

    if (dedicatedConversationUrl && this.page.url() !== dedicatedConversationUrl) {
      await this.page.goto(dedicatedConversationUrl, {
        waitUntil: "domcontentloaded",
      });
    }

    return this.page;
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error("Browser session has not been started.");
    }

    return this.page;
  }

  async stop(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
    this.context = null;
    this.page = null;
  }
}
