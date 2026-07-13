import type { Runtime } from "../core/Runtime.js";
import { extractKapEnvelope } from "../kap/KapExtractor.js";
import { createKapSuccessReport, createKapErrorReport } from "../kap/KapReport.js";
import { routeKapJob } from "../runtime/kap-job-router.js";
import { kapJobToTask } from "../kap/KapTaskAdapter.js";
import { BrowserDriver } from "../browser/BrowserDriver.js";
import { VerificationRuntimeAdapter } from "../verification/VerificationRuntimeAdapter.js";

export class BrowserAgent {
  private readonly processedJobIds = new Set<string>();
  private readonly verification = new VerificationRuntimeAdapter();

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
      const kap = extractKapEnvelope(messageText);

      if (!kap) {
        await watcher.markFailed(messageText);
        continue;
      }

      if (kap.type !== "JOB") {
        await watcher.markReported(messageText);
        continue;
      }

      if (this.processedJobIds.has(kap.id)) {
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
        const verification = this.verification.verify(result);

        if (result.status === "COMPLETED") {
          await conversation.sendMessage(
            "```kap\n" +
            JSON.stringify({
              protocol: "KAP",
              version: "1.0",
              type: "REPORT",
              id: "report-" + kap.id,
              createdAt: new Date().toISOString(),
              payload: {
                jobId: kap.id,
                status: result.status,
                result,
                verification,
              },
            }, null, 2) +
            "\n```",
          );
          await watcher.markReported(messageText);
        } else {
          await conversation.sendMessage(createKapErrorReport(kap.id, result.error ?? "Runtime failed.", result));
          await watcher.markFailed(messageText);
        }
      } catch (error: any) {
        await conversation.sendMessage(
          createKapErrorReport(kap.id, error.message ?? String(error), {
            taskId: kap.id,
            status: "FAILED",
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: 0,
            stepsRun: 0,
            steps: [],
            error: error.message ?? String(error),
          } as any),
        );
        await watcher.markFailed(messageText);
      }
    }
  }
}
