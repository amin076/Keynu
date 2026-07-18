import type { Runtime } from "../core/Runtime.js";
import { createKapErrorReport } from "../kap/KapReport.js";
import { routeKapJob } from "../runtime/kap-job-router.js";
import { ProviderRuntime } from "../runtime/ProviderRuntime.js";
import { kapJobToTask } from "../kap/KapTaskAdapter.js";
import { BrowserDriver } from "./BrowserDriver.js";
import { VerificationReportIntegration } from "../verification/VerificationReportIntegration.js";
import { MissionManager } from "../mission/MissionManager.js";
import { BrowserContinuationCoordinator } from "../mission/BrowserContinuationCoordinator.js";
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
    missionMemoryRevision:
      acknowledgement.payload.acknowledgedMemoryRevision,
    missionAcknowledgedAt: acknowledgedAt,
    missionRestorationStaleReason: undefined,
    runtimeState: "idle",
  };
}

export class BrowserAgent {
  private readonly processedJobIds = new Set<string>();
  private readonly processedMissionAckIds = new Set<string>();
  private readonly verification = new VerificationReportIntegration();
  private readonly missionManager = new MissionManager();
  private readonly continuationCoordinator = new BrowserContinuationCoordinator();
  private readonly graphTracer = new RuntimeGraphTracer();
  private readonly providerRuntime = new ProviderRuntime();

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
        await watcher.markFailed(messageText);

        const missionStatus=this.missionManager.getStatus();
        if(missionStatus){
          await this.continuationCoordinator.continueAfterReport({
            missionId:missionStatus.missionId,
            missionTitle:missionStatus.title,
            jobId:`non-kap-${Date.now()}`,
            reportStatus:"FAILED",
            nextAction:"Recover after non-KAP assistant response",
            consecutiveFailureCount:1
          },async (message) => {
            await conversation.sendMessage(message);
          });
        }
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
            createMissionAcknowledgementSessionPatch(
              kap as MissionAckPayload,
            ),
          );

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

          this.graphTracer.traceCompleted(traceContext, rawResult);

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

          await conversation.sendMessage(serializeBrowserReport(certifiedReport));

          if (status === "COMPLETED") {
            this.missionManager.recordJob(kap.id);

            try {
              const missionStatus = this.missionManager.getStatus();
              const missionId =
                kap.metadata?.missionId ||
                missionStatus?.missionId ||
                'keynu-active-mission';

              const continuationResult =
                await this.continuationCoordinator.continueAfterReport(
                  {
                    missionId,
                    missionTitle: missionStatus?.title,
                    jobId: kap.id,
                    reportStatus:
                      certifiedReport?.payload?.status ||
                      routedPayload?.status ||
                      rawResult?.status ||
                      'UNKNOWN',
                    nextAction:
                      missionStatus?.openTasks?.[0] ||
                      'generate_next_safe_verifiable_kap_job',
                    autonomousStepCount: 0,
                    maxAutonomousSteps: 12,
                  },
                  async (message) => {
                    await conversation.sendMessage(message);
                  },
                );

              console.log(
                '[agent] Continuation request result:',
                continuationResult.deliveryStatus,
                continuationResult.requestId,
);
            } catch (continuationError) {
              console.error(
                '[agent] Continuation coordination failed:',
                continuationError instanceof Error
                  ? continuationError.message
                  : String(continuationError),
);
            }
            await watcher.markReported(messageText);
          } else {
            await watcher.markFailed(messageText);
          }

          continue;
        }

        const task = kapJobToTask(kap);
        const result = await this.runtime.execute(task);
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
        this.graphTracer.traceFailed(traceContext, error);

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


  async seedWatcherBaseline(): Promise<void> {
    await this.browser.getWatcher().seedBaseline();
  }
}
