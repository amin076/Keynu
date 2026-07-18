import type { NormalizedAPIConfig } from './APIConfig.js';
import type { APIStream } from './APIStreaming.js';
import type { ProviderRequest } from './ProviderRequest.js';
import type { ProviderResponse } from './ProviderResponse.js';

export type APIRequestLog = {
  type: 'request';
  providerId: string;
  requestId: string;
  endpoint: string;
  model?: string;
  attempt: number;
  metadata?: Record<string, unknown>;
};

export type APIResponseLog = {
  type: 'response';
  providerId: string;
  requestId: string;
  status: 'completed' | 'failed' | 'cancelled';
  durationMs: number;
  attempt: number;
  metadata?: Record<string, unknown>;
};

export type APILogEntry = APIRequestLog | APIResponseLog;
export type APILogger = (entry: APILogEntry) => void | Promise<void>;

export type TransportExecutionContext = {
  config: NormalizedAPIConfig;
  attempt: number;
  signal?: AbortSignal;
  log?: APILogger;
};

export interface TransportAdapter {
  readonly id: string;
  execute(
    request: ProviderRequest,
    context: TransportExecutionContext,
  ): Promise<ProviderResponse>;
  stream?(
    request: ProviderRequest,
    context: TransportExecutionContext,
  ): APIStream;
  cancel?(requestId: string, reason?: string): Promise<void>;
}
