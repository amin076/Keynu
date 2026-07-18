import { createAPIMessage } from '../api/APIMessage.js';
import type { APITokenUsage } from '../api/APITokenUsage.js';
import {
  createProviderResponse,
  type ProviderResponse,
} from '../api/ProviderResponse.js';

type OpenAIUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
    [key: string]: unknown;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

export function interpretOpenAIUsage(value: unknown): APITokenUsage | undefined {
  const usage = record(value) as OpenAIUsage | null;
  if (!usage) return undefined;
  const categories: Record<string, number> = {};

  for (const [key, item] of Object.entries(usage)) {
    if (typeof item === 'number') {
      categories[key] = item;
    }
  }

  return {
    promptTokens: usage.input_tokens,
    completionTokens: usage.output_tokens,
    cachedTokens: usage.input_tokens_details?.cached_tokens,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens,
    totalTokens: usage.total_tokens,
    categories,
  };
}

export function extractOpenAIText(response: unknown): string {
  const item = record(response);
  if (!item) return '';

  if (typeof item.output_text === 'string') {
    return item.output_text;
  }

  const output = Array.isArray(item.output) ? item.output : [];
  const parts: string[] = [];

  for (const outputItem of output) {
    const outputRecord = record(outputItem);
    const content = Array.isArray(outputRecord?.content)
      ? outputRecord.content
      : [];

    for (const contentItem of content) {
      const contentRecord = record(contentItem);
      const value = text(contentRecord?.text) ?? text(contentRecord?.refusal);
      if (value) parts.push(value);
    }
  }

  return parts.join('');
}

export function interpretOpenAIResponse(
  requestId: string,
  providerId: string,
  response: unknown,
): ProviderResponse {
  const item = record(response);
  const content = extractOpenAIText(response);
  const finishReason =
    text(item?.status) ??
    text(record(item?.incomplete_details)?.reason);

  return createProviderResponse({
    id: text(item?.id),
    requestId,
    providerId,
    model: text(item?.model),
    message: createAPIMessage('assistant', content, {
      metadata: {
        toolCalls: item?.tool_calls,
        output: item?.output,
      },
    }),
    content,
    finishReason,
    usage: interpretOpenAIUsage(item?.usage),
    metadata: {
      object: item?.object,
      status: item?.status,
      createdAt: item?.created_at,
    },
    raw: response,
  });
}
