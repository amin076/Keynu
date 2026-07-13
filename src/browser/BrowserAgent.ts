import type { Runtime } from "../core/Runtime.js";
import { extractKapEnvelope } from "../kap/KapExtractor.js";
import { createKapErrorReport } from "../kap/KapReport.js";
import { routeKapJob } from "../runtime/kap-job-router.js";
import { kapJobToTask } from "../kap/KapTaskAdapter.js";
import { BrowserDriver } from "./BrowserDriver.js";
import { VerificationReportIntegration } from "../verification/VerificationReportIntegration.js";
import { MissionManager } from "../mission/MissionManager.js";
import type { MissionAckPayload } from "../mission/MissionTypes.js";
import { SessionStore } from "../session/index.js";

export class BrowserAgent {
  private readonly processedJobIds = new Set<string>();
  private readonly processedMissionAckIds = new Set<string>();
  private readonly verification = new VerificationReportIntegration();
  private readonly missionManager = new MissionManager();

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
      const kap = extractKapEnvelope(messageText) as any;

      if (!kap) {
        await watcher.markReported(messageText);
        continue;
      }

      if (kap.type === "MISSION_ACK") {
        if (this.processedMissionAckIds.has(kap.id)) {
          await watcher.markReported(messageText);
          continue;
        }

        this.processedMissionAckIds.add(kap.id);

        try {
          const state = this.missionManager.acknowledge(
            kap as MissionAckPayload,
          );

          new SessionStore().patch({
            memoryRestored: true,
            missionAcknowledgedAt: new Date().toISOString(),
            runtimeState: "idle",
          });

          new SessionStore().patch({
            memoryRestored: true,
            missionAcknowledgedAt: new Date().toISOString(),
            runtimeState: "idle",
          });

          console.log(
            `[agent] Mission acknowledgement accepted for '${state.missionId}'.`,
          );

          await watcher.markReported(messageText);
        } catch (error: any) {
          console.error(
            `[agent] Mission acknowledgement failed: ${error.message ?? String(error)}`,
          );
          await watcher.markFailed(messageText);
        }

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
        const target = kap.payload?.target;

        if (target === "powershell" || target === "filesystem") {
          const routedReport: any = await routeKapJob(kap);
          const routedPayload = routedReport?.payload ?? {};
          const rawResult = routedPayload.result ?? {};
          const now = new Date().toISOString();
          const startedAt =
            typeof rawResult.startedAt === "string" ? rawResult.startedAt : now;
          const finishedAt =
            typeof rawResult.finishedAt === "string" ? rawResult.finishedAt : now;
          const status =
            rawResult.status === "COMPLETED" || routedPayload.status === "COMPLETED"
              ? "COMPLETED"
              : "FAILED";

          const evidenceStep = {
            index: 0,
            status,
            startedAt,
            finishedAt,
            durationMs:
              typeof rawResult.durationMs === "number"
                ? rawResult.durationMs
                : Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
            command: {
              target,
              jobId: kap.id,
            },
            result: rawResult,
            error: rawResult.error ?? routedPayload.error,
          };

          const executionResult: any = {
            ...rawResult,
            taskId: rawResult.taskId ?? rawResult.jobId ?? kap.id,
            status,
            startedAt,
            finishedAt,
            durationMs: evidenceStep.durationMs,
            stepsRun: 1,
            steps: [evidenceStep],
            error: rawResult.error ?? routedPayload.error,
          };

          const verified = this.verification.createVerifiedReport(executionResult);
          const certifiedReport = {
            ...routedReport,
            payload: {
              ...routedPayload,
              jobId: routedPayload.jobId ?? kap.id,
              target: routedPayload.target ?? target,
              status,
              result: rawResult,
              verification: verified.verification,
              certificate: verified.certificate,
            },
          };

          await conversation.sendMessage(
            "```kap\n" + JSON.stringify(certifiedReport, null, 2) + "\n```",
          );

          if (status === "COMPLETED") {
            this.missionManager.recordJob(kap.id);
            await watcher.markReported(messageText);
          } else {
            await watcher.markFailed(messageText);
          }

          continue;
        }

        const task = kapJobToTask(kap);
        const result = await this.runtime.execute(task);
        const verified = this.verification.createVerifiedReport(result);

        if (result.status === "COMPLETED") {
          await conversation.sendMessage(
            "```kap\n" +
              JSON.stringify(
                {
                  protocol: "KAP",
                  version: "1.0",
                  type: "REPORT",
                  id: "report-" + kap.id,
                  createdAt: new Date().toISOString(),
                  payload: {
                    jobId: kap.id,
                    status: "COMPLETED",
                    result,
                    verification: verified.verification,
                    certificate: verified.certificate,
                  },
                },
                null,
                2,
              ) +
              "\n```",
          );

          this.missionManager.recordJob(kap.id);
          await watcher.markReported(messageText);
        } else {
          await conversation.sendMessage(
            createKapErrorReport(
              kap.id,
              result.error ?? "Runtime failed.",
              result,
            ),
          );
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
