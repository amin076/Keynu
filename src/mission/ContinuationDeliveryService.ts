import {
  buildContinuationRequest,
  type ContinuationRequestContext,
} from './ContinuationRequestBuilder.js';
import { ContinuationDeliveryStore } from './ContinuationDeliveryStore.js';

export type ContinuationMessageSender = (message: string) => Promise<void>;

export type ContinuationDeliveryResult = {
  requestId: string;
  resumeToken: string;
  status:
    | 'DELIVERED'
    | 'SKIPPED_POLICY'
    | 'SKIPPED_DUPLICATE'
    | 'FAILED';
  reason: string;
};

export class ContinuationDeliveryService {
  constructor(
    private readonly store = new ContinuationDeliveryStore(),
  ) {}

  async deliver(
    context: ContinuationRequestContext,
    sendMessage: ContinuationMessageSender,
  ): Promise<ContinuationDeliveryResult> {
    const request = buildContinuationRequest(context);

    if (!request.shouldSend) {
      return {
        requestId: request.requestId,
        resumeToken: request.resumeToken,
        status: 'SKIPPED_POLICY',
        reason: request.reason,
      };
    }

    const reservation = this.store.reserve({
      requestId: request.requestId,
      missionId: context.missionId,
      resumeToken: request.resumeToken,
    });

    if (
      !reservation.created &&
      reservation.record.status === 'DELIVERED'
    ) {
      return {
        requestId: request.requestId,
        resumeToken: request.resumeToken,
        status: 'SKIPPED_DUPLICATE',
        reason: 'The same continuation request was already delivered.',
      };
    }

    this.store.markAttempt(request.requestId);

    try {
      await sendMessage(request.message);
      this.store.markDelivered(request.requestId);

      return {
        requestId: request.requestId,
        resumeToken: request.resumeToken,
        status: 'DELIVERED',
        reason: 'Continuation request delivered successfully.',
      };
    } catch (error) {
      this.store.markFailed(request.requestId, error);

      return {
        requestId: request.requestId,
        resumeToken: request.resumeToken,
        status: 'FAILED',
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
