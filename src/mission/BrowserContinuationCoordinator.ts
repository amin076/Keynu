import { ActiveMissionResolver } from './ActiveMissionResolver.js';
import { ContinuationDeliveryService } from './ContinuationDeliveryService.js';
import { ContinuationStore } from './ContinuationStore.js';
import { MissionStateStore } from './MissionStateStore.js';
import type { ContinuationContract } from './ContinuationTypes.js';

export type BrowserContinuationMissionContext = {
  missionId: string;
  missionTitle?: string;
  jobId: string;
  reportStatus: string;
  nextAction?: string;
  autonomousStepCount?: number;
  consecutiveFailureCount?: number;
  maxAutonomousSteps?: number;
};

export type BrowserContinuationResult = {
  missionId: string;
  jobId: string;
  decision: ContinuationContract['decision'];
  deliveryStatus:
    | 'DELIVERED'
    | 'SKIPPED_POLICY'
    | 'SKIPPED_DUPLICATE'
    | 'FAILED';
  requestId: string;
  resumeToken: string;
  reason: string;
};

export type BrowserContinuationCoordinatorOptions = {
  continuationStore?: ContinuationStore;
  deliveryService?: ContinuationDeliveryService;
  activeMissionResolver?: ActiveMissionResolver;
  missionStateStore?: MissionStateStore;
};

function normalizeStatus(value: string): string {
  return value.trim().toUpperCase();
}

export class BrowserContinuationCoordinator {
  private readonly continuationStore: ContinuationStore;
  private readonly deliveryService: ContinuationDeliveryService;
  private readonly activeMissionResolver: ActiveMissionResolver;
  private readonly missionStateStore: MissionStateStore;

  constructor(options: BrowserContinuationCoordinatorOptions = {}) {
    this.continuationStore =
      options.continuationStore || new ContinuationStore();
    this.deliveryService =
      options.deliveryService || new ContinuationDeliveryService();
    this.activeMissionResolver =
      options.activeMissionResolver || new ActiveMissionResolver();
    this.missionStateStore =
      options.missionStateStore || new MissionStateStore();
  }

  async continueAfterReport(
    context: BrowserContinuationMissionContext,
    sendMessage: (message: string) => Promise<void>,
  ): Promise<BrowserContinuationResult> {
    const resolvedMission = this.activeMissionResolver.resolve();

    if (resolvedMission.action === 'BLOCKED') {
      return {
        missionId: context.missionId,
        jobId: context.jobId,
        decision: 'WAITING_AI',
        deliveryStatus: 'SKIPPED_POLICY',
        requestId: `blocked-${context.missionId}`,
        resumeToken: '',
        reason: `SKIPPED_ACTIVE_MISSION_UNRESOLVED: ${resolvedMission.diagnostics.join(' ')}`,
      };
    }

    if (context.missionId !== resolvedMission.missionId) {
      return {
        missionId: context.missionId,
        jobId: context.jobId,
        decision: 'WAITING_AI',
        deliveryStatus: 'SKIPPED_POLICY',
        requestId: `stale-${context.missionId}`,
        resumeToken: '',
        reason: `SKIPPED_NON_ACTIVE_MISSION: resolved active mission is '${resolvedMission.missionId}'.`,
      };
    }

    const runtimeState = this.missionStateStore.getMission(
      resolvedMission.missionId,
    );

    if (runtimeState?.status === 'COMPLETED') {
      return {
        missionId: context.missionId,
        jobId: context.jobId,
        decision: 'COMPLETED',
        deliveryStatus: 'SKIPPED_POLICY',
        requestId: `terminal-${context.missionId}`,
        resumeToken: '',
        reason: 'SKIPPED_COMPLETED_MISSION',
      };
    }

    const reportStatus = normalizeStatus(context.reportStatus);
    const completed = reportStatus === 'COMPLETED';

    const continuation: ContinuationContract = completed
      ? {
          decision: 'WAITING_AI',
          reason:
            'The previous KAP job completed successfully. Evaluate the result and select a new, distinct mission step. Do not repeat the completed action.',
          nextAction:
            'evaluate_completed_job_and_select_next_distinct_mission_step',
          owner: 'ai',
          missionComplete: false,
          retryable: false,
        }
      : {
          decision: 'WAITING_AI',
          reason:
            'The previous KAP job did not complete successfully and the active mission requires an AI recovery decision.',
          nextAction: context.nextAction || 'evaluate_failure_and_generate_recovery_job',
          owner: 'ai',
          missionComplete: false,
          retryable: true,
        };

    const autonomousStepCount = (context.autonomousStepCount || 0) + 1;
    const consecutiveFailureCount = completed
      ? 0
      : (context.consecutiveFailureCount || 0) + 1;

    const persisted = this.continuationStore.record(
      context.missionId,
      'WAITING_AI',
      continuation,
      {
        jobId: context.jobId,
        autonomousStepCount,
        consecutiveFailureCount,
      },
    );

    const delivery = await this.deliveryService.deliver(
      {
        missionId: context.missionId,
        missionTitle: context.missionTitle,
        jobId: context.jobId,
        continuation: persisted.continuation,
        autonomousStepCount: context.autonomousStepCount || 0,
        maxAutonomousSteps: context.maxAutonomousSteps || 12,
      },
      sendMessage,
    );

    return {
      missionId: context.missionId,
      jobId: context.jobId,
      decision: persisted.continuation.decision,
      deliveryStatus: delivery.status,
      requestId: delivery.requestId,
      resumeToken: delivery.resumeToken,
      reason: delivery.reason,
    };
  }
}
