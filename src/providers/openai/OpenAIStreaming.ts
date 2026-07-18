import { APIProviderError } from '../api/APIError.js';
import type { APIStreamEvent } from '../api/APIStreaming.js';
import {
  interpretOpenAIResponse,
  interpretOpenAIUsage,
} from './OpenAIResponseInterpreter.js';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function mapOpenAIStreamEvent(
  requestId: string,
  providerId: string,
  event: unknown,
): APIStreamEvent | null {
  const item = record(event);
  if (!item) return null;

  const type = typeof item?.type === 'string' ? item.type : '';

  if (type === 'response.created' || type === 'response.in_progress') {
    return {
      type: 'started',
      requestId,
      providerId,
      metadata: {
        openaiType: type,
        response: item.response,
      },
    };
  }

  if (
    type === 'response.output_text.delta' ||
    type === 'response.refusal.delta' ||
    type.endsWith('.delta')
  ) {
    return {
      type: 'delta',
      requestId,
      delta: typeof item.delta === 'string' ? item.delta : '',
      metadata: {
        openaiType: type,
        itemId: item.item_id,
      },
    };
  }

  if (type === 'response.completed') {
    return {
      type: 'completed',
      requestId,
      response: interpretOpenAIResponse(
        requestId,
        providerId,
        item.response,
      ),
      metadata: {
        openaiType: type,
      },
    };
  }

  if (type === 'response.failed' || type === 'error') {
    const error = record(item.error);
    return {
      type: 'failed',
      requestId,
      error: new APIProviderError({
        category: 'internal_provider_error',
        message:
          typeof error?.message === 'string'
            ? error.message
            : 'OpenAI stream failed.',
        retryable: false,
        providerErrorCode:
          typeof error?.code === 'string' ? error.code : undefined,
        metadata: {
          openaiType: type,
        },
      }),
    };
  }

  if (type === 'response.cancelled') {
    return {
      type: 'cancelled',
      requestId,
      reason: 'OpenAI response was cancelled.',
      metadata: {
        openaiType: type,
      },
    };
  }

  if (item?.usage) {
    return {
      type: 'usage',
      requestId,
      usage: interpretOpenAIUsage(item.usage) ?? {},
      metadata: {
        openaiType: type,
      },
    };
  }

  return null;
}
