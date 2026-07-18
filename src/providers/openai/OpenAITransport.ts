import { APIProviderError, normalizeAPIError } from '../api/APIError.js';
import type { APIStream } from '../api/APIStreaming.js';
import type {
  TransportAdapter,
  TransportExecutionContext,
} from '../api/APITransport.js';
import type { ProviderRequest } from '../api/ProviderRequest.js';
import type { ProviderResponse } from '../api/ProviderResponse.js';
import { createOpenAIAuthenticationHeaders } from './OpenAIAuthentication.js';
import { buildOpenAIRequestBody } from './OpenAIPromptBuilder.js';
import { interpretOpenAIResponse } from './OpenAIResponseInterpreter.js';
import { mapOpenAIStreamEvent } from './OpenAIStreaming.js';

export type OpenAIFetch = typeof fetch;

export type OpenAITransportOptions = {
  fetch?: OpenAIFetch;
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const parsed = await response.json() as {
      error?: {
        message?: string;
      };
    };
    return parsed.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function errorCategory(status: number): APIProviderError['category'] {
  if (status === 401 || status === 403) return 'authentication';
  if (status === 402) return 'quota';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rate_limit';
  if (status === 400 || status === 422) return 'invalid_request';
  if (status >= 500) return 'provider_unavailable';
  return 'internal_provider_error';
}

async function* parseSse(
  response: Response,
  request: ProviderRequest,
): AsyncIterable<unknown> {
  if (!response.body) {
    throw new APIProviderError({
      category: 'stream_interrupted',
      message: 'OpenAI stream response did not include a body.',
      retryable: true,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const dataLines = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim());

      for (const data of dataLines) {
        if (!data || data === '[DONE]') continue;
        try {
          yield JSON.parse(data);
        } catch (error) {
          throw new APIProviderError({
            category: 'stream_interrupted',
            message: 'OpenAI stream emitted invalid JSON.',
            retryable: true,
            cause: error,
            metadata: {
              requestId: request.id,
            },
          });
        }
      }
    }
  }
}

export class OpenAITransport implements TransportAdapter {
  readonly id = 'openai-rest';
  private readonly fetch: OpenAIFetch;

  constructor(options: OpenAITransportOptions = {}) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async execute(
    request: ProviderRequest,
    context: TransportExecutionContext,
  ): Promise<ProviderResponse> {
    const response = await this.fetch(context.config.endpoint, {
      method: 'POST',
      headers: this.createHeaders(context),
      body: JSON.stringify(buildOpenAIRequestBody(request, context.config)),
      signal: context.signal,
    });

    if (!response.ok) {
      throw new APIProviderError({
        category: errorCategory(response.status),
        message: await readErrorMessage(response),
        statusCode: response.status,
        retryable: response.status === 429 || response.status >= 500,
      });
    }

    try {
      return interpretOpenAIResponse(
        request.id,
        request.providerId,
        await response.json(),
      );
    } catch (error) {
      throw normalizeAPIError(error);
    }
  }

  async *stream(
    request: ProviderRequest,
    context: TransportExecutionContext,
  ): APIStream {
    const response = await this.fetch(context.config.endpoint, {
      method: 'POST',
      headers: this.createHeaders(context),
      body: JSON.stringify(
        buildOpenAIRequestBody(
          {
            ...request,
            parameters: {
              ...(request.parameters ?? {}),
              stream: true,
            },
          },
          context.config,
        ),
      ),
      signal: context.signal,
    });

    if (!response.ok) {
      throw new APIProviderError({
        category: errorCategory(response.status),
        message: await readErrorMessage(response),
        statusCode: response.status,
        retryable: response.status === 429 || response.status >= 500,
      });
    }

    yield {
      type: 'started',
      requestId: request.id,
      providerId: request.providerId,
    };

    for await (const openAIEvent of parseSse(response, request)) {
      const event = mapOpenAIStreamEvent(
        request.id,
        request.providerId,
        openAIEvent,
      );

      if (event) {
        yield event;
      }
    }
  }

  private createHeaders(
    context: TransportExecutionContext,
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...createOpenAIAuthenticationHeaders(context.config),
      ...(context.config.headers ?? {}),
    };
  }
}
