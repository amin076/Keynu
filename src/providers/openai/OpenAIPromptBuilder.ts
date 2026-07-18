import type { NormalizedAPIConfig } from '../api/APIConfig.js';
import type { APIMessage } from '../api/APIMessage.js';
import type { ProviderRequest } from '../api/ProviderRequest.js';

export type OpenAIRequestMessage = {
  role: string;
  content: unknown;
  name?: string;
};

export type OpenAIRequestBody = {
  model: string;
  input: OpenAIRequestMessage[];
  instructions?: string;
  temperature?: number;
  top_p?: number;
  max_output_tokens?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
};

function messageToOpenAI(message: APIMessage): OpenAIRequestMessage {
  return {
    role: message.role,
    content: message.content,
    name: message.name,
  };
}

export function buildOpenAIRequestBody(
  request: ProviderRequest,
  config: NormalizedAPIConfig,
): OpenAIRequestBody {
  const maxTokens = request.parameters?.maxOutputTokens ??
    (typeof config.metadata?.maxTokens === 'number'
      ? config.metadata.maxTokens
      : undefined);

  return {
    model: request.model ?? config.model ?? '',
    input: request.messages.map(messageToOpenAI),
    instructions: request.systemPrompt,
    temperature: request.parameters?.temperature ?? config.temperature,
    top_p: request.parameters?.topP ?? config.topP,
    max_output_tokens: maxTokens,
    stream: request.parameters?.stream ?? config.stream,
    metadata: request.metadata,
  };
}
