import type { APIMessage } from './APIMessage.js';
import type { APITokenUsage } from './APITokenUsage.js';
import type { ProviderResponse } from './ProviderResponse.js';

export type APIStreamEvent =
  | {
      type: 'started';
      requestId: string;
      providerId: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'delta';
      requestId: string;
      delta: string;
      message?: Partial<APIMessage>;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'usage';
      requestId: string;
      usage: APITokenUsage;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'completed';
      requestId: string;
      response: ProviderResponse;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'failed';
      requestId: string;
      error: Error;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'cancelled';
      requestId: string;
      reason?: string;
      metadata?: Record<string, unknown>;
    };

export type APIStream = AsyncIterable<APIStreamEvent>;
export type APIStreamHandler = (event: APIStreamEvent) => void | Promise<void>;

export async function collectStream(stream: APIStream): Promise<APIStreamEvent[]> {
  const events: APIStreamEvent[] = [];

  for await (const event of stream) {
    events.push(event);
  }

  return events;
}
