export type APIConfig = {
  providerId: string;
  providerName?: string;
  endpoint: string;
  apiKey?: string;
  organization?: string;
  project?: string;
  model?: string;
  timeoutMs?: number;
  retryCount?: number;
  stream?: boolean;
  temperature?: number;
  topP?: number;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
};

export type NormalizedAPIConfig = Required<
  Pick<APIConfig, 'providerId' | 'endpoint' | 'timeoutMs' | 'retryCount' | 'stream'>
> &
  Omit<APIConfig, 'timeoutMs' | 'retryCount' | 'stream'>;

export function normalizeAPIConfig(config: APIConfig): NormalizedAPIConfig {
  if (!config.providerId.trim()) {
    throw new Error('API provider id is required.');
  }

  if (!config.endpoint.trim()) {
    throw new Error('API provider endpoint is required.');
  }

  if (config.timeoutMs !== undefined && (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 0 || config.timeoutMs > 3600000)) {
    throw new Error('API timeoutMs must be an integer from 0 to 3600000.');
  }
  if (config.retryCount !== undefined && (!Number.isInteger(config.retryCount) || config.retryCount < 0 || config.retryCount > 10)) {
    throw new Error('API retryCount must be an integer from 0 to 10.');
  }
  return {
    ...config,
    timeoutMs: Math.max(1, config.timeoutMs ?? 30_000),
    retryCount: Math.max(0, config.retryCount ?? 0),
    stream: config.stream ?? false,
  };
}
