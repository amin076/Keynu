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

    console.log("[agent] BrowserAgent loop started.");

    while (true) {
      const messageText = await watcher.waitForNewAssistantMessage();

      console.log("[agent] Assistant message received. Extracting KAP...");

      const kap = extractKapEnvelope(messageText);

      if (!kap) {
        console.log("[agent] No KAP block found. Ignoring message.");
        await watcher.markFailed(messageText);
        continue;
      }

      console.log(`[agent] KAP found: ${kap.type} ${kap.id}`);

      if (kap.type !== "JOB") {
        console.log("[agent] KAP is not JOB. Marking as reported/read.");
        await watcher.markReported(messageText);
        continue;
      }

      const result = await this.runtime.execute(kap.payload as any);

      if (result.status === "COMPLETED") {
        console.log("[agent] Runtime completed. Sending success report...");
        await conversation.sendMessage(createKapSuccessReport(kap.id, result));
        await watcher.markReported(messageText);
        console.log("[agent] Success report sent.");
        continue;
      }

      console.log("[agent] Runtime failed. Sending error report...");
      await conversation.sendMessage(
        createKapErrorReport(
          kap.id,
          result.error ?? "Runtime execution failed.",
          result,
        ),
      );

      await watcher.markFailed(messageText);
      console.log("[agent] Error report sent.");
    }
  }
}
