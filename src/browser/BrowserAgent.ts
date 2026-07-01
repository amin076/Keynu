import type { Runtime } from "../core/Runtime.js";
import { extractKapEnvelope } from "../kap/KapExtractor.js";
import { createKapSuccessReport, createKapErrorReport } from "../kap/KapReport.js";
import { BrowserDriver } from "./BrowserDriver.js";

export class BrowserAgent {
  constructor(
    private readonly browser: BrowserDriver,
    private readonly runtime: Runtime,
  ) {}

  async start(): Promise<void> {
    const conversation = this.browser.getConversation();
    const watcher = this.browser.getWatcher();

    while (true) {
      const messageText = await watcher.waitForNewAssistantMessage();
      const kap = extractKapEnvelope(messageText);

      if (!kap) {
        continue;
      }

      if (kap.type !== "JOB") {
        continue;
      }

      try {
        await this.runtime.execute(kap.payload as any);

        await conversation.sendMessage(
          createKapSuccessReport(kap.id),
        );

        await watcher.markReported(messageText);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);

        await conversation.sendMessage(
          createKapErrorReport(kap.id, message),
        );

        await watcher.markFailed(messageText);
      }
    }
  }
}
