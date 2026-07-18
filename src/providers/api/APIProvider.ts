import type { AIProvider, AIProviderStartOptions } from '../AIProvider.js';
import type { ProviderCapabilities } from '../ProviderCapabilities.js';
import { createProviderResult, type ProviderResult } from '../ProviderResult.js';
import type { ProviderSession } from '../ProviderSession.js';
import type { ProviderTask } from '../ProviderTask.js';
import {
  normalizeAPIConfig,
  type APIConfig,
  type NormalizedAPIConfig,
} from './APIConfig.js';
import {
  normalizeAPIError,
  APIProviderError,
} from './APIError.js';
import type { APIStream } from './APIStreaming.js';
import type {
  APILogger,
  TransportAdapter,
} from './APITransport.js';
import {
  createProviderRequest,
  type ProviderRequest,
} from './ProviderRequest.js';
import type { ProviderResponse } from './ProviderResponse.js';

export type APIProviderOptions = {
  config: APIConfig;
  transport: TransportAdapter;
  log?: APILogger;
  now?: () => Date;
};

export class APIProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities = {
    transport: 'api',
    capabilities: ['text.generate'],
    supportsMissionBootstrap: false,
    supportsKap: false,
    supportsContinuation: false,
    supportsInteractiveSession: false,
  };

  private readonly config: NormalizedAPIConfig;
  private readonly transport: TransportAdapter;
  private readonly log?: APILogger;
  private readonly now: () => Date;

  constructor(options: APIProviderOptions) {
    this.config = normalizeAPIConfig(options.config);
    this.id = this.config.providerId;
    this.name = this.config.providerName ?? this.config.providerId;
    this.transport = options.transport;
    this.log = options.log;
    this.now = options.now ?? (() => new Date());
  }

  createSession(input: Partial<ProviderSession> = {}): ProviderSession {
    return {
      id: input.id ?? `${this.id}-session-${Date.now()}`,
      providerId: this.id,
      status: input.status ?? 'created',
      missionProjectId: input.missionProjectId,
      missionId: input.missionId,
      conversationUrl: input.conversationUrl,
      startedAt: input.startedAt,
      stoppedAt: input.stoppedAt,
      metadata: input.metadata,
    };
  }

  async start(options: AIProviderStartOptions): Promise<ProviderResult> {
    return createProviderResult(
      this.id,
      options.task ?? {
        id: `start-${options.session.id}`,
        type: 'start-session',
      },
      'accepted',
      {
        session: {
          ...options.session,
          providerId: this.id,
          status: 'active',
          startedAt: options.session.startedAt ?? this.now().toISOString(),
        },
      },
    );
  }

  async execute(task: ProviderTask, session?: ProviderSession): Promise<ProviderResult> {
    try {
      const request = this.requestFromTask(task, session);
      const response = await this.executeRequest(request);

      return createProviderResult(this.id, task, 'completed', {
        session,
        output: response,
        metadata: {
          usage: response.usage,
          model: response.model,
          finishReason: response.finishReason,
        },
      });
    } catch (error) {
      const normalized = normalizeAPIError(error);
      return createProviderResult(this.id, task, 'failed', {
        session,
        error: normalized.message,
        metadata: {
          category: normalized.category,
          retryable: normalized.retryable,
          statusCode: normalized.statusCode,
        },
      });
    }
  }

  async executeRequest(request: ProviderRequest): Promise<ProviderResponse> {
    const errors: APIProviderError[] = [];

    for (let attempt = 1; attempt <= this.config.retryCount + 1; attempt += 1) {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort(new Error('API request timed out.'));
      }, this.config.timeoutMs);
      const signal = this.combineSignals(request.signal, controller.signal);

      await this.log?.({
        type: 'request',
        providerId: this.id,
        requestId: request.id,
        endpoint: this.config.endpoint,
        model: request.model ?? this.config.model,
        attempt,
      });

      try {
        const response = await this.transport.execute(
          request,
          {
            config: this.config,
            attempt,
            signal,
            log: this.log,
          },
        );

        clearTimeout(timeout);
        await this.log?.({
          type: 'response',
          providerId: this.id,
          requestId: request.id,
          status: 'completed',
          durationMs: Date.now() - startedAt,
          attempt,
          metadata: {
            responseId: response.id,
          },
        });
        return response;
      } catch (error) {
        clearTimeout(timeout);
        const normalized = normalizeAPIError(error);
        errors.push(normalized);

        await this.log?.({
          type: 'response',
          providerId: this.id,
          requestId: request.id,
          status: normalized.category === 'cancelled' ? 'cancelled' : 'failed',
          durationMs: Date.now() - startedAt,
          attempt,
          metadata: {
            category: normalized.category,
            retryable: normalized.retryable,
          },
        });

        if (!normalized.retryable || attempt > this.config.retryCount) {
          throw normalized;
        }
      }
    }

    throw errors.at(-1) ?? new APIProviderError({
      category: 'unknown',
      message: 'API request failed.',
      retryable: false,
    });
  }

  streamRequest(request: ProviderRequest): APIStream {
    if (!this.transport.stream) {
      throw new APIProviderError({
        category: 'invalid_request',
        message: `Transport '${this.transport.id}' does not support streaming.`,
        retryable: false,
      });
    }

    return this.transport.stream(request, {
      config: this.config,
      attempt: 1,
      signal: request.signal,
      log: this.log,
    });
  }

  async cancel(requestId: string, reason?: string): Promise<void> {
    await this.transport.cancel?.(requestId, reason);
  }

  private requestFromTask(
    task: ProviderTask,
    session?: ProviderSession,
  ): ProviderRequest {
    if (this.isProviderRequest(task.input)) {
      return task.input;
    }

    return createProviderRequest({
      id: task.id,
      providerId: this.id,
      conversationId: session?.id,
      missionProjectId: task.missionProjectId ?? session?.missionProjectId,
      missionId: task.missionId ?? session?.missionId,
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: typeof task.input === 'string' ? task.input : JSON.stringify(task.input ?? ''),
        },
      ],
      parameters: {
        temperature: this.config.temperature,
        topP: this.config.topP,
        stream: this.config.stream,
      },
      metadata: task.metadata,
    });
  }

  private isProviderRequest(value: unknown): value is ProviderRequest {
    return Boolean(
      value &&
      typeof value === 'object' &&
      Array.isArray((value as ProviderRequest).messages) &&
      typeof (value as ProviderRequest).providerId === 'string',
    );
  }

  private combineSignals(
    left: AbortSignal | undefined,
    right: AbortSignal,
  ): AbortSignal {
    if (!left) return right;
    if (left.aborted) return left;

    const controller = new AbortController();
    const abort = () => controller.abort();

    left.addEventListener('abort', abort, { once: true });
    right.addEventListener('abort', abort, { once: true });

    return controller.signal;
  }
}
