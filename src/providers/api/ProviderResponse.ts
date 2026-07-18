import type { APIMessage } from './APIMessage.js';
import type { APITokenUsage } from './APITokenUsage.js';

export type ProviderResponse = {
  id: string;
  requestId: string;
  providerId: string;
  model?: string;
  message?: APIMessage;
  content?: string;
  finishReason?: string;
  usage?: APITokenUsage;
  metadata?: Record<string, unknown>;
  raw?: unknown;
  createdAt: string;
};

export type CreateProviderResponseInput = Omit<
  ProviderResponse,
  'id' | 'createdAt'
> & {
  id?: string;
  createdAt?: string;
};

export function createProviderResponse(
  input: CreateProviderResponseInput,
): ProviderResponse {
  return {
    ...input,
    id: input.id ?? `provider-response-${Date.now()}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
