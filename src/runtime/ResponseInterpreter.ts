import type { APIMessageContent } from '../providers/api/APIMessage.js';
import type { ProviderResponse } from '../providers/api/ProviderResponse.js';

export type InterpretedProviderResponse = {
  text: string;
  response: ProviderResponse;
  metadata: Record<string, unknown>;
};

function contentToText(content: APIMessageContent | undefined): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part.text === 'string') return part.text;
      if (typeof part.data === 'string') return part.data;
      return '';
    })
    .join('');
}

export class ResponseInterpreter {
  interpret(response: ProviderResponse): InterpretedProviderResponse {
    const text = response.content ??
      contentToText(response.message?.content) ??
      '';

    return {
      text,
      response,
      metadata: {
        responseId: response.id,
        requestId: response.requestId,
        providerId: response.providerId,
        model: response.model,
        finishReason: response.finishReason,
      },
    };
  }
}
