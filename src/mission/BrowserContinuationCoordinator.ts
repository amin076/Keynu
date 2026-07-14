import { ContinuationDeliveryService } from './ContinuationDeliveryService.js';
import { ContinuationStore } from './ContinuationStore.js';
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
};

function normalizeStatus(value: string): string {
  return value.trim().toUpperCase();
}

export class BrowserContinuationCoordinator {
  private readonly continuationStore: ContinuationStore;
  private readonly deliveryService: ContinuationDeliveryService;

  constructor(options: BrowserContinuationCoordinatorOptions = {}) {
    this.continuationStore =
      options.continuationStore || new ContinuationStore();
    this.deliveryService =
      options.deliveryService || new ContinuationDeliveryService();
  }

  async continueAfterReport(
    context: BrowserContinuationMissionContext,
    sendMessage: (message: string) => Promise<void>,
  ): Promise<BrowserContinuationResult> {
    const reportStatus = normalizeStatus(context.reportStatus);
    const completed = reportStatus === 'COMPLETED';

    const continuation: ContinuationContract = completed
      ? {
          decision: 'WAITING_AI',
          reason:
            'The previous KAP job completed successfully and the active mission requires evaluation of the next safe step.',
          nextAction:
            context.nextAction || 'generate_next_safe_verifiable_kap_job',
          owner: 'ai',
          missionComplete: false,
          retryable: true,
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

    const autonomousStepCount = context.autonomousStepCount || 0;
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
        autonomousStepCount: persisted.autonomousStepCount,
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
