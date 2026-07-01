import { defaultBrowserConfig, type BrowserConfig } from "./BrowserConfig.js";
import { BrowserSession } from "./BrowserSession.js";

export class BrowserDriver {
  readonly name = "browser";

  private readonly session: BrowserSession;

  constructor(config: BrowserConfig = defaultBrowserConfig) {
    this.session = new BrowserSession(config);
  }

  async initialize(): Promise<void> {
    await this.session.start();
  }

  async shutdown(): Promise<void> {
    await this.session.stop();
  }
}