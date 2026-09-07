import type { Runtime } from "../core/Runtime.js";
import { createKapErrorReport } from "../kap/KapReport.js";
import { JobCommunicationCenter } from "../kap/JobCommunicationCenter.js";
import { routeKapJob } from "../runtime/kap-job-router.js";
import { ProviderRuntime } from "../runtime/ProviderRuntime.js";
import { PersistentJobStore, type StoredJobState } from "../runtime/PersistentJobStore.js";
import { kapJobToTask } from "../kap/KapTaskAdapter.js";
import { BrowserDriver } from "./BrowserDriver.js";
import { VerificationReportIntegration } from "../verification/VerificationReportIntegration.js";
import { MissionManager } from "../mission/MissionManager.js";
import { BrowserContinuationCoordinator } from "../mission/BrowserContinuationCoordinator.js";
import { BrowserContinuationReminderService } from "../mission/BrowserContinuationReminderService.js";
import type { MissionAckPayload } from "../mission/MissionTypes.js";
import { SessionStore, type KeynuSessionPatch } from "../session/index.js";
import { RuntimeGraphTracer } from "../graph/RuntimeGraphTracer.js";
import { serializeBrowserReport } from "./BrowserReportDelivery.js";
import type { ProviderResponse } from "../providers/api/ProviderResponse.js";

export function createMissionAcknowledgementSessionPatch(
  acknowledgement: MissionAckPayload,
  acknowledgedAt = new Date().toISOString(),
): KeynuSessionPatch {
  return {
    memoryRestored: true,
    missionProjectId: acknowledgement.payload.projectId,
    missionId: acknowledgement.payload.missionId,
    missionBootstrapId: acknowledgement.payload.acknowledgedBootstrapId,
    missionMemoryRevision: acknowledgement.payload.acknowledgedMemoryRevision,
    missionAcknowledgedAt: acknowledgedAt,
    missionRestorationStaleReason: undefined,
    runtimeState: "idle",
  };
}

function isTerminalJobState(
  state: StoredJobState,
): state is "COMPLETED" | "FAILED" | "CANCELLED" {
  return state === "COMPLETED" || state === "FAILED" || state === "CANCELLED";
}

export class BrowserAgent {
  private readonly processedMissionAckIds = new Set<string>();
  private readonly verification = new VerificationReportIntegration();
  private readonly missionManager = new MissionManager();
  private readonly graphTracer = new RuntimeGraphTracer();
  private readonly providerRuntime = new ProviderRuntime();
  private readonly jobStore = new PersistentJobStore();
  private readonly continuationCoordinator = new BrowserContinuationCoordinator();
  private readonly continuationReminderService: BrowserContinuationReminderService;
  private readonly communicationCenter: JobCommunicationCenter;

  constructor(
    private readonly browser: BrowserDriver,
    private readonly runtime: Runtime,
  ) {
    this.continuationReminderService = new BrowserContinuationReminderService(
      async (message) => {
        console.log("[ReminderDebug] reminder callback invoked");
        console.log("[ReminderDebug] sending reminder message");
        await this.browser.getConversation().sendMessage(message);
        console.log("[ReminderDebug] reminder message sent");
      },
    );

    this.communicationCenter = new JobCommunicationCenter(
      async (message) => {
        await this.browser.getConversation().sendMessage(message);
      },
      { jobStore: this.jobStore },
    );
  }

  private async continueAfterReport(
    kap: any,
    reportStatus: string,
    result: any,
    sendMessage: (message: string) => Promise<void>,
  ): Promise<void> {
    const missionId = kap.metadata?.missionId;

    if (!missionId) {
      console.log(
        "[agent] Continuation request result:",
        "SKIPPED_NO_MISSION_ID",
      );
      return;
    }

    const continuationResult =
      await this.continuationCoordinator.continueAfterReport(
        {
          missionId,
          missionTitle: kap.metadata?.missionTitle,
          jobId: kap.id,
          reportStatus,
          nextAction: result?.nextAction,
          autonomousStepCount: result?.autonomousStepCount,
          consecutiveFailureCount: result?.consecutiveFailureCount,
          maxAutonomousSteps: result?.maxAutonomousSteps,
        },
        sendMessage,
      );

    console.log(
      "[agent] Continuation request result:",
      continuationResult,
    );

    this.continuationReminderService.start();
  }

  async start(): Promise<void> {
    const conversation = this.browser.getConversation();
    const watcher = this.browser.getWatcher();
    const sendMessage = async (message: string): Promise<void> => {
      await conversation.sendMessage(message);
    };

    console.log("[agent] BrowserAgent loop started.");

    const recoveredReports =
      await this.communicationCenter.recoverUndeliveredReports();
    if (recoveredReports.length > 0) {
      console.log(
        `[agent] Recovered ${recoveredReports.length} previously undelivered terminal report(s).`,
      );
    }

    while (true) {
      const messageText = await watcher.waitForNewAssistantMessage();

      console.log("[ReminderDebug] cancel() called");
      this.continuationReminderService.cancel();

      console.log("[agent] Assistant message received.");

      const providerResponse: ProviderResponse = {
        id: `browser-agent-message-${Date.now()}`,
        requestId: "browser-agent-conversation",
        providerId: "browser-agent-chatgpt",
        content: messageText,
        createdAt: new Date().toISOString(),
      };

      const runtimeResult = await this.providerRuntime.execute(
        providerResponse,
        {
          source: "browser-agent",
        },
      );

      const kap = runtimeResult.items[0]?.envelope as any;

      if (kap?.type === "JOB") {
        console.log(`[agent] KAP job extracted: ${kap.id}`);
      }

      if (!kap) {
        console.error("[agent] KAP extraction or validation failed.");

        const message =
          "Recover after non-KAP assistant response: resend the previous response as exactly one valid ```kap``` envelope. Do not include prose outside the KAP block.";

        await conversation.sendMessage(message);
        await watcher.markFailed(messageText);
        continue;
      }

      console.log(
        `[agent] KAP envelope accepted: type=${kap.type}, id=${kap.id}`,
      );

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

          new SessionStore().patch(
            createMissionAcknowledgementSessionPatch(kap as MissionAckPayload),
          );

          console.log(
            `[agent] Mission acknowledgement accepted for '${state.missionId}'.`,
          );

          await watcher.markReported(messageText);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          console.error(
            `[agent] Mission acknowledgement failed: ${errorMessage}`,
          );

          await watcher.markFailed(messageText);
        }

        continue;
      }

      if (kap.type !== "JOB") {
        await watcher.markReported(messageText);
        continue;
      }

      const claim = await this.jobStore.claim(kap.id);

      if (!claim.created) {
        const stored = claim.record;
        console.log(
          `[agent] Persistent duplicate KAP job detected: ${kap.id} (${stored.state}).`,
        );

        if (stored.reportText) {
          if (!stored.reportDeliveredAt) {
            await this.communicationCenter.recoverUndeliveredReports();
          }

          const refreshed = await this.jobStore.get(kap.id);
          if (isTerminalJobState(stored.state) && refreshed?.reportDeliveredAt) {
            await this.continueAfterReport(
              kap,
              stored.state,
              {},
              sendMessage,
            );
          }

          if (stored.state === "COMPLETED") {
            await watcher.markReported(messageText);
          } else {
            await watcher.markFailed(messageText);
          }
          continue;
        }

        if (!isTerminalJobState(stored.state)) {
          await this.jobStore.markInterrupted(kap.id);
          const interruptedMessage =
            "KAP job was already claimed before this BrowserAgent process observed it, but no verified report was persisted. Automatic re-execution is blocked to avoid duplicate side effects.";
          const errorResult = {
            taskId: kap.id,
            status: "FAILED",
            startedAt: stored.updatedAt,
            finishedAt: new Date().toISOString(),
            durationMs: 0,
            stepsRun: 0,
            steps: [],
            error: interruptedMessage,
          } as any;
          const errorReport = createKapErrorReport(
            kap.id,
            interruptedMessage,
            errorResult,
          );

          await this.communicationCenter.terminal(
            kap,
            "FAILED",
            interruptedMessage,
          );
          const delivery = await this.communicationCenter.deliverTerminalReport(
            kap,
            "FAILED",
            errorReport,
            `error-${kap.id}`,
          );

          if (delivery.delivered) {
            await this.continueAfterReport(
              kap,
              "FAILED",
              { nextAction: "evaluate_interrupted_job_without_reexecuting_side_effects" },
              sendMessage,
            );
          }
        }

        await watcher.markFailed(messageText);
        continue;
      }

      await this.communicationCenter.received(kap);
      await this.communicationCenter.analyzed(kap, {
        target: kap.payload?.target,
        cwd: kap.payload?.cwd,
        readCount: Array.isArray(kap.payload?.readFiles)
          ? kap.payload.readFiles.length
          : 0,
        writeCount: Array.isArray(kap.payload?.writeFiles)
          ? kap.payload.writeFiles.length
          : 0,
        commandCount: Array.isArray(kap.payload?.commands)
          ? kap.payload.commands.length
          : 0,
      });
      await this.jobStore.set(kap.id, "RUNNING");
      await this.communicationCenter.started(kap);

      const traceContext = {
        jobId: kap.id,
        missionId: kap.metadata?.missionId,
        workflowId: kap.metadata?.workflowId,
        taskId: kap.id,
        target: kap.payload?.target,
      };

      this.graphTracer.traceQueued(traceContext);

      try {
        const target = kap.payload?.target;
        this.graphTracer.traceStarted(traceContext);

        if (target === "powershell" || target === "filesystem") {
          const routedReport: any = await routeKapJob(kap, {
            onProgress: async (event) => {
              await this.communicationCenter.progress(kap, event);
            },
          });
          const routedPayload = routedReport?.payload ?? {};
          const rawResult = routedPayload.result ?? {};
          const now = new Date().toISOString();

          const startedAt =
            typeof rawResult.startedAt === "string" ? rawResult.startedAt : now;

          const finishedAt =
            typeof rawResult.finishedAt === "string"
              ? rawResult.finishedAt
              : now;

          const status =
            rawResult.status === "COMPLETED" ||
            routedPayload.status === "COMPLETED"
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

          this.graphTracer.traceCompleted(traceContext, rawResult);

          const verified =
            this.verification.createVerifiedReport(executionResult);

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
          const reportText = serializeBrowserReport(certifiedReport);

          await this.communicationCenter.terminal(
            kap,
            status,
            status === "COMPLETED"
              ? "KAP job execution and verification completed."
              : "KAP job execution or verification failed.",
          );
          const delivery = await this.communicationCenter.deliverTerminalReport(
            kap,
            status,
            reportText,
            certifiedReport.id,
          );

          if (!delivery.delivered) {
            console.error(
              `[agent] Terminal report for ${kap.id} remains undelivered after ${delivery.attempts} attempts: ${delivery.lastError ?? "unknown delivery failure"}`,
            );
            await watcher.markFailed(messageText);
            continue;
          }

          await this.continueAfterReport(
            kap,
            status,
            rawResult,
            sendMessage,
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

        for (let index = 0; index < result.steps.length; index += 1) {
          const step = result.steps[index];
          await this.communicationCenter.progress(kap, {
            stage: step.status === "COMPLETED" ? "COMPLETED" : "FAILED",
            phase: "runtime",
            index: index + 1,
            total: result.steps.length,
            name: JSON.stringify(step.command),
            message: step.error,
          });
        }

        this.graphTracer.traceCompleted(traceContext, {
          status: result.status,
          commands: result.steps.map((step) => ({
            command: JSON.stringify(step.command),
            ok: step.status === "COMPLETED",
            error: step.error,
          })),
        });

        const verified = this.verification.createVerifiedReport(result);

        if (result.status === "COMPLETED") {
          const reportEnvelope = {
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
          };
          const reportText =
            "```kap\n" + JSON.stringify(reportEnvelope, null, 2) + "\n```";

          await this.communicationCenter.terminal(kap, "COMPLETED");
          const delivery = await this.communicationCenter.deliverTerminalReport(
            kap,
            "COMPLETED",
            reportText,
            reportEnvelope.id,
          );

          if (!delivery.delivered) {
            console.error(
              `[agent] Terminal report for ${kap.id} remains undelivered after ${delivery.attempts} attempts: ${delivery.lastError ?? "unknown delivery failure"}`,
            );
            await watcher.markFailed(messageText);
            continue;
          }

          await this.continueAfterReport(
            kap,
            "COMPLETED",
            result,
            sendMessage,
          );

          this.missionManager.recordJob(kap.id);
          await watcher.markReported(messageText);
        } else {
          const errorReport = createKapErrorReport(
            kap.id,
            result.error ?? "Runtime failed.",
            result,
          );

          await this.communicationCenter.terminal(
            kap,
            "FAILED",
            result.error ?? "Runtime failed.",
          );
          const delivery = await this.communicationCenter.deliverTerminalReport(
            kap,
            "FAILED",
            errorReport,
            `error-${kap.id}`,
          );

          if (delivery.delivered) {
            await this.continueAfterReport(
              kap,
              "FAILED",
              result,
              sendMessage,
            );
          }

          await watcher.markFailed(messageText);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        this.graphTracer.traceFailed(traceContext, error);

        const errorResult = {
          taskId: kap.id,
          status: "FAILED",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          stepsRun: 0,
          steps: [],
          error: errorMessage,
        } as any;
        const errorReport = createKapErrorReport(
          kap.id,
          errorMessage,
          errorResult,
        );

        await this.communicationCenter.terminal(
          kap,
          "FAILED",
          errorMessage,
        );
        const delivery = await this.communicationCenter.deliverTerminalReport(
          kap,
          "FAILED",
          errorReport,
          `error-${kap.id}`,
        );

        if (delivery.delivered) {
          await this.continueAfterReport(
            kap,
            "FAILED",
            errorResult,
            sendMessage,
          );
        }

        await watcher.markFailed(messageText);
      }
    }
  }

  async seedWatcherBaseline(): Promise<void> {
    await this.browser.getWatcher().seedBaseline();
  }
}
