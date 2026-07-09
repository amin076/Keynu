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
    this.browser = await chromium.connectOverCDP("http://127.0.0.1:9222");

    this.context = this.browser.contexts()[0];

    if (!this.context) {
      throw new Error(
        "No Chrome context found. Start Chrome with --remote-debugging-port=9222.",
      );
    }

    this.page =
      this.context
        .pages()
        .find((page) => page.url().startsWith(this.config.defaultUrl)) ??
      this.context.pages()[0] ??
      (await this.context.newPage());

    if (this.config.dedicatedConversationUrl) {
      await this.page.goto(this.config.dedicatedConversationUrl, {
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
