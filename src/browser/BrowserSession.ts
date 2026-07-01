import { chromium, type BrowserContext, type Page } from "playwright";
import type { BrowserConfig } from "./BrowserConfig.js";

export class BrowserSession {
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(private readonly config: BrowserConfig) {}

  async start(): Promise<Page> {
    this.context = await chromium.launchPersistentContext(
      this.config.userDataDir,
      {
        headless: this.config.headless,
      },
    );

    this.page = this.context.pages()[0] ?? await this.context.newPage();

    await this.page.goto(this.config.defaultUrl, {
      waitUntil: "domcontentloaded",
    });

    return this.page;
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error("Browser session has not been started.");
    }

    return this.page;
  }

  async stop(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this.page = null;
  }
}
