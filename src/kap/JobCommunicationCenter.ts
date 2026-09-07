import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { KapEnvelope } from "./KapEnvelope.js";
import {
  PersistentJobStore,
  type StoredJob,
} from "../runtime/PersistentJobStore.js";

export const DEFAULT_JOB_HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;
export const DEFAULT_JOB_STALL_WARNING_MS = 5 * 60 * 1000;
export const DEFAULT_STATUS_MIN_INTERVAL_MS = 30 * 1000;
export const DEFAULT_REPORT_DELIVERY_ATTEMPTS = 5;
export const DEFAULT_REPORT_RETRY_DELAYS_MS = [1000, 3000, 10000, 30000] as const;

export type JobLifecycleStage =
  | "RECEIVED"
  | "ANALYZED"
  | "STARTED"
  | "STEP_STARTED"
  | "STEP_COMPLETED"
  | "STEP_FAILED"
  | "STEP_SKIPPED"
  | "HEARTBEAT"
  | "STATUS_DELIVERED"
  | "STATUS_DELIVERY_FAILED"
  | "REPORT_PERSISTED"
  | "REPORT_DELIVERY_ATTEMPT"
  | "REPORT_DELIVERED"
  | "REPORT_DELIVERY_FAILED"
  | "COMPLETED"
  | "FAILED";

export type JobProgressEvent = {
  stage: "STARTED" | "COMPLETED" | "FAILED" | "SKIPPED";
  phase: string;
  index?: number;
  total?: number;
  name?: string;
  message?: string;
  details?: Record<string, unknown>;
};

export type JobCommunicationAuditEvent = {
  jobId: string;
  missionId?: string;
  workflowId?: string;
  stage: JobLifecycleStage;
  occurredAt: string;
  elapsedMs: number;
  currentStep?: string;
  message?: string;
  details?: Record<string, unknown>;
};

export type JobCommunicationCenterOptions = {
  cwd?: string;
  heartbeatIntervalMs?: number;
  stallWarningMs?: number;
  statusMinIntervalMs?: number;
  reportDeliveryAttempts?: number;
  reportRetryDelaysMs?: readonly number[];
  jobStore?: PersistentJobStore;
};

export type TerminalReportDeliveryResult = {
  delivered: boolean;
  attempts: number;
  lastError?: string;
};

type JobRuntimeState = {
  startedAt: number;
  lastProgressAt: number;
  lastStatusQueuedAt: number;
  currentStep?: string;
  heartbeatTimer?: ReturnType<typeof setInterval>;
  heartbeatInFlight: boolean;
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wrapKap(value: unknown): string {
  const fence = String.fromCharCode(96).repeat(3);
  return `${fence}kap\n${JSON.stringify(value, null, 2)}\n${fence}`;
}

export class JobCommunicationCenter {
  private readonly heartbeatIntervalMs: number;
  private readonly stallWarningMs: number;
  private readonly statusMinIntervalMs: number;
  private readonly reportDeliveryAttempts: number;
  private readonly reportRetryDelaysMs: readonly number[];
  private readonly auditPath: string;
  private readonly jobStore: PersistentJobStore;
  private readonly runtime = new Map<string, JobRuntimeState>();
  private deliveryChain: Promise<void> = Promise.resolve();
  private auditChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly sendMessage: (message: string) => Promise<void>,
    options: JobCommunicationCenterOptions = {},
  ) {
    const cwd = options.cwd ?? process.cwd();
    this.heartbeatIntervalMs =
      options.heartbeatIntervalMs ?? DEFAULT_JOB_HEARTBEAT_INTERVAL_MS;
    this.stallWarningMs = options.stallWarningMs ?? DEFAULT_JOB_STALL_WARNING_MS;
    this.statusMinIntervalMs =
      options.statusMinIntervalMs ?? DEFAULT_STATUS_MIN_INTERVAL_MS;
    this.reportDeliveryAttempts =
      options.reportDeliveryAttempts ?? DEFAULT_REPORT_DELIVERY_ATTEMPTS;
    this.reportRetryDelaysMs =
      options.reportRetryDelaysMs ?? DEFAULT_REPORT_RETRY_DELAYS_MS;
    this.auditPath = resolve(cwd, ".keynu", "state", "job-communications.jsonl");
    this.jobStore = options.jobStore ?? new PersistentJobStore(cwd);
  }

  async received(kap: KapEnvelope): Promise<void> {
    const now = Date.now();
    this.runtime.set(kap.id, {
      startedAt: now,
      lastProgressAt: now,
      lastStatusQueuedAt: 0,
      heartbeatInFlight: false,
    });
    await this.recordAndNotify(
      kap,
      "RECEIVED",
      "KAP job received by Keynu.",
      undefined,
      true,
    );
  }

  async analyzed(
    kap: KapEnvelope,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.recordAndNotify(
      kap,
      "ANALYZED",
      "KAP job validated and analyzed; execution plan accepted.",
      details,
      true,
    );
  }

  async started(kap: KapEnvelope): Promise<void> {
    const state = this.ensureRuntime(kap.id);
    state.lastProgressAt = Date.now();
    await this.recordAndNotify(
      kap,
      "STARTED",
      "KAP job execution started.",
      undefined,
      true,
    );
    this.startHeartbeat(kap);
  }

  async progress(kap: KapEnvelope, event: JobProgressEvent): Promise<void> {
    const state = this.ensureRuntime(kap.id);
    state.lastProgressAt = Date.now();
    state.currentStep = this.describeStep(event);

    const lifecycleStage: JobLifecycleStage =
      event.stage === "STARTED"
        ? "STEP_STARTED"
        : event.stage === "COMPLETED"
          ? "STEP_COMPLETED"
          : event.stage === "FAILED"
            ? "STEP_FAILED"
            : "STEP_SKIPPED";

    const force = event.stage === "FAILED";
    await this.recordAndNotify(
      kap,
      lifecycleStage,
      event.message ?? this.describeStep(event),
      {
        phase: event.phase,
        index: event.index,
        total: event.total,
        name: event.name,
        ...event.details,
      },
      force,
    );
  }

  async terminal(
    kap: KapEnvelope,
    status: "COMPLETED" | "FAILED",
    message?: string,
  ): Promise<void> {
    this.stopHeartbeat(kap.id);
    await this.record(
      kap,
      status,
      message ??
        (status === "COMPLETED" ? "KAP job completed." : "KAP job failed."),
    );
  }

  async deliverTerminalReport(
    kap: KapEnvelope,
    state: "COMPLETED" | "FAILED" | "CANCELLED",
    reportText: string,
    reportId?: string,
  ): Promise<TerminalReportDeliveryResult> {
    this.stopHeartbeat(kap.id);
    await this.jobStore.recordReport(kap.id, state, reportText, reportId);
    await this.record(
      kap,
      "REPORT_PERSISTED",
      "Terminal KAP report persisted before delivery.",
    );

    return this.deliverPersistedReport(kap, await this.jobStore.get(kap.id));
  }

  async recoverUndeliveredReports(): Promise<TerminalReportDeliveryResult[]> {
    const pending = await this.jobStore.listUndeliveredReports();
    const results: TerminalReportDeliveryResult[] = [];

    for (const record of pending) {
      const synthetic: KapEnvelope = {
        protocol: "KAP",
        version: "1.0",
        type: "JOB",
        id: record.jobId,
      };
      results.push(await this.deliverPersistedReport(synthetic, record));
    }

    return results;
  }

  private async deliverPersistedReport(
    kap: KapEnvelope,
    record: StoredJob | undefined,
  ): Promise<TerminalReportDeliveryResult> {
    if (!record?.reportText) {
      return {
        delivered: false,
        attempts: 0,
        lastError: "No persisted terminal report is available.",
      };
    }

    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.reportDeliveryAttempts; attempt += 1) {
      await this.jobStore.markReportDeliveryAttempt(record.jobId);
      await this.record(
        kap,
        "REPORT_DELIVERY_ATTEMPT",
        `Terminal report delivery attempt ${attempt}/${this.reportDeliveryAttempts}.`,
        { attempt, maximumAttempts: this.reportDeliveryAttempts },
      );

      try {
        await this.sendSerialized(record.reportText);
        await this.jobStore.markReportDelivered(record.jobId);
        await this.record(
          kap,
          "REPORT_DELIVERED",
          "Terminal KAP report delivery was confirmed by the browser submission layer.",
          { attempt },
        );
        return { delivered: true, attempts: attempt };
      } catch (error) {
        lastError = describeError(error);
        await this.jobStore.markReportDeliveryFailed(record.jobId, lastError);
        await this.record(
          kap,
          "REPORT_DELIVERY_FAILED",
          `Terminal report delivery attempt ${attempt} failed.`,
          { attempt, error: lastError },
        );

        if (attempt < this.reportDeliveryAttempts) {
          const delay =
            this.reportRetryDelaysMs[attempt - 1] ??
            this.reportRetryDelaysMs.at(-1) ??
            1000;
          await wait(delay);
        }
      }
    }

    return {
      delivered: false,
      attempts: this.reportDeliveryAttempts,
      lastError,
    };
  }

  private startHeartbeat(kap: KapEnvelope): void {
    const state = this.ensureRuntime(kap.id);
    this.stopHeartbeat(kap.id);

    state.heartbeatTimer = setInterval(() => {
      if (state.heartbeatInFlight) return;
      state.heartbeatInFlight = true;

      void this.sendHeartbeat(kap)
        .catch((error) => {
          console.error(
            `[job-communication-center] heartbeat failed for ${kap.id}: ${describeError(error)}`,
          );
        })
        .finally(() => {
          state.heartbeatInFlight = false;
        });
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(jobId: string): void {
    const state = this.runtime.get(jobId);
    if (!state?.heartbeatTimer) return;
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = undefined;
  }

  private async sendHeartbeat(kap: KapEnvelope): Promise<void> {
    const state = this.ensureRuntime(kap.id);
    const now = Date.now();
    const stalledForMs = now - state.lastProgressAt;
    const stalled = stalledForMs >= this.stallWarningMs;
    const message = stalled
      ? "Job is still running, but no step transition has been observed within the stall-warning window."
      : "Job is still running normally.";

    await this.recordAndNotify(
      kap,
      "HEARTBEAT",
      message,
      {
        currentStep: state.currentStep,
        stalled,
        stalledForMs,
      },
      true,
    );
  }

  private async recordAndNotify(
    kap: KapEnvelope,
    stage: JobLifecycleStage,
    message: string,
    details?: Record<string, unknown>,
    force = false,
  ): Promise<void> {
    const event = await this.record(kap, stage, message, details);
    const state = this.ensureRuntime(kap.id);
    const now = Date.now();
    const shouldSend =
      force ||
      stage === "RECEIVED" ||
      stage === "ANALYZED" ||
      stage === "STARTED" ||
      stage === "HEARTBEAT" ||
      stage === "STEP_FAILED" ||
      now - state.lastStatusQueuedAt >= this.statusMinIntervalMs;

    if (!shouldSend) return;

    // Throttle at enqueue time, not successful-delivery time. This prevents a
    // busy ChatGPT composer from allowing many rapid step events to pile up
    // behind one slow status submission.
    state.lastStatusQueuedAt = now;

    const envelope = {
      protocol: "KAP",
      version: "1.0",
      type: "JOB_STATUS",
      id: `status-${kap.id}-${stage.toLowerCase()}-${now}`,
      createdAt: event.occurredAt,
      metadata: {
        correlationId: kap.id,
        missionId: kap.metadata?.missionId,
        workflowId: kap.metadata?.workflowId,
      },
      payload: {
        jobId: kap.id,
        stage,
        status: stage === "STEP_FAILED" ? "ATTENTION" : "ACTIVE",
        message,
        elapsedMs: event.elapsedMs,
        currentStep: event.currentStep,
        details,
        requiresResponse: false,
        noActionRequired: true,
        instruction:
          "Telemetry only. Do not issue a replacement KAP JOB until a terminal REPORT or ERROR arrives.",
      },
    };

    // Non-terminal telemetry must never delay or determine executor success.
    // It is queued on the single browser transport lane and audited when that
    // transport eventually succeeds or fails. The final REPORT awaits this
    // lane, preserving message ordering without blocking execution startup.
    this.enqueueStatusDelivery(kap, stage, wrapKap(envelope));
  }

  private enqueueStatusDelivery(
    kap: KapEnvelope,
    stage: JobLifecycleStage,
    message: string,
  ): void {
    void this.enqueueDelivery(async () => {
      try {
        await this.sendMessage(message);
        await this.record(
          kap,
          "STATUS_DELIVERED",
          `Non-terminal ${stage} status was submitted successfully.`,
          { statusStage: stage },
        );
      } catch (error) {
        await this.record(
          kap,
          "STATUS_DELIVERY_FAILED",
          "Non-terminal status delivery failed; execution will continue.",
          { statusStage: stage, error: describeError(error) },
        );
      }
    });
  }

  private async sendSerialized(message: string): Promise<void> {
    await this.enqueueDelivery(() => this.sendMessage(message));
  }

  private enqueueDelivery(operation: () => Promise<void>): Promise<void> {
    const run = this.deliveryChain
      .catch(() => undefined)
      .then(operation);

    // Keep the lane usable after a failed terminal delivery attempt. Callers
    // still receive the original run rejection so retry logic can act on it.
    this.deliveryChain = run.catch(() => undefined);
    return run;
  }

  private async record(
    kap: KapEnvelope,
    stage: JobLifecycleStage,
    message?: string,
    details?: Record<string, unknown>,
  ): Promise<JobCommunicationAuditEvent> {
    const state = this.ensureRuntime(kap.id);
    const event: JobCommunicationAuditEvent = {
      jobId: kap.id,
      missionId: kap.metadata?.missionId,
      workflowId: kap.metadata?.workflowId,
      stage,
      occurredAt: new Date().toISOString(),
      elapsedMs: Math.max(0, Date.now() - state.startedAt),
      currentStep: state.currentStep,
      message,
      details,
    };

    const line = JSON.stringify(event) + "\n";
    const write = this.auditChain
      .catch(() => undefined)
      .then(async () => {
        await mkdir(dirname(this.auditPath), { recursive: true });
        await appendFile(this.auditPath, line, "utf8");
      });

    this.auditChain = write.catch(() => undefined);
    await write;
    return event;
  }

  private ensureRuntime(jobId: string): JobRuntimeState {
    const existing = this.runtime.get(jobId);
    if (existing) return existing;

    const now = Date.now();
    const state: JobRuntimeState = {
      startedAt: now,
      lastProgressAt: now,
      lastStatusQueuedAt: 0,
      heartbeatInFlight: false,
    };
    this.runtime.set(jobId, state);
    return state;
  }

  private describeStep(event: JobProgressEvent): string {
    const ordinal =
      typeof event.index === "number" && typeof event.total === "number"
        ? ` ${event.index}/${event.total}`
        : "";
    const name = event.name ? `: ${event.name}` : "";
    return `${event.phase}${ordinal}${name} ${event.stage.toLowerCase()}`;
  }
}
