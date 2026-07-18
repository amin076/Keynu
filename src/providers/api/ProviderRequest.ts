import type { APIMessage } from './APIMessage.js';

export type ProviderRequestParameters = {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  stream?: boolean;
  custom?: Record<string, unknown>;
};

export type ProviderRequest = {
  id: string;
  providerId: string;
  conversationId?: string;
  missionProjectId?: string;
  missionId?: string;
  model?: string;
  systemPrompt?: string;
  messages: APIMessage[];
  parameters?: ProviderRequestParameters;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
};

export type CreateProviderRequestInput = Omit<ProviderRequest, 'id'> & {
  id?: string;
};

export function createProviderRequest(
  input: CreateProviderRequestInput,
): ProviderRequest {
  if (input.messages.length === 0 && !input.systemPrompt) {
    throw new Error('ProviderRequest requires messages or a systemPrompt.');
  }

  return {
    ...input,
    id: input.id ?? `provider-request-${Date.now()}`,
    messages: input.messages.map((message) => ({ ...message })),
  };
}
