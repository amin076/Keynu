import type { Runtime } from "../core/Runtime.js";
import { extractKapEnvelope } from "../kap/KapExtractor.js";
import { createKapSuccessReport, createKapErrorReport } from "../kap/KapReport.js";
import { routeKapJob } from "../runtime/kap-job-router.js";
import { kapJobToTask } from "../kap/KapTaskAdapter.js";
import { BrowserDriver } from "./BrowserDriver.js";

export class BrowserAgent {
  private readonly processedJobIds = new Set<string>();

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
        await watcher.markReported(messageText);
        continue;
      }

      if (this.processedJobIds.has(kap.id)) {
        console.log(`[agent] Duplicate job ignored: ${kap.id}`);
        await watcher.markReported(messageText);
        continue;
      }

      this.processedJobIds.add(kap.id);

      try {
        if ((kap as any).payload?.target === "powershell" || (kap as any).payload?.target === "filesystem") {
          const report = await routeKapJob(kap as any);
          await conversation.sendMessage("```kap\n" + JSON.stringify(report, null, 2) + "\n```");
          await watcher.markReported(messageText);
          continue;
        }

        const task = kapJobToTask(kap as any);
        const result = await this.runtime.execute(task);

        if (result.status === "COMPLETED") {
          await conversation.sendMessage(createKapSuccessReport(kap.id, result));
          await watcher.markReported(messageText);
        } else {
          await conversation.sendMessage(
            createKapErrorReport(kap.id, result.error ?? "Runtime failed.", result),
          );
          await watcher.markFailed(messageText);
        }

      } catch (error: any) {
        console.error("[agent] Job execution crashed:", error);

        await conversation.sendMessage(
          createKapErrorReport(
            kap.id,
            error.message ?? String(error),
            {
              taskId: kap.id,
              status: "FAILED",
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
              durationMs: 0,
              stepsRun: 0,
              steps: [],
              error: error.message ?? String(error),
            } as any,
          ),
        );

        await watcher.markFailed(messageText);
      }
    }
  }
}
