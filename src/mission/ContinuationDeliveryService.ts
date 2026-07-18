import {
  buildContinuationRequest,
  type ContinuationRequestContext,
} from './ContinuationRequestBuilder.js';
import { ContinuationDeliveryStore } from './ContinuationDeliveryStore.js';

const CONTINUATION_MAX_DELIVERY_ATTEMPTS = 3;
const CONTINUATION_RETRY_DELAYS_MS = [750, 1750] as const;

function waitForContinuationRetry(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function describeContinuationDeliveryError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}


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

    let lastError: unknown;

    for (
      let attempt = 1;
      attempt <= CONTINUATION_MAX_DELIVERY_ATTEMPTS;
      attempt += 1
    ) {
      try {
        await sendMessage(request.message);
        this.store.markDelivered(request.requestId);

        return {
          requestId: request.requestId,
          resumeToken: request.resumeToken,
          status: 'DELIVERED',
          reason: 'Continuation request delivered.',
        };
      } catch (error) {
        lastError = error;

        if (attempt < CONTINUATION_MAX_DELIVERY_ATTEMPTS) {
          const delay =
            CONTINUATION_RETRY_DELAYS_MS[attempt - 1] ??
            CONTINUATION_RETRY_DELAYS_MS.at(-1) ??
            750;
          await waitForContinuationRetry(delay);
        }
      }
    }

    const failureReason = describeContinuationDeliveryError(lastError);
    this.store.markFailed(request.requestId, failureReason);

    return {
      requestId: request.requestId,
      resumeToken: request.resumeToken,
      status: 'FAILED',
      reason: failureReason,
    };

  }
}
