export type APIErrorCategory =
  | 'authentication'
  | 'quota'
  | 'network'
  | 'timeout'
  | 'invalid_request'
  | 'provider_unavailable'
  | 'rate_limit'
  | 'stream_interrupted'
  | 'internal_provider_error'
  | 'cancelled'
  | 'unknown';

export type NormalizedAPIError = {
  category: APIErrorCategory;
  message: string;
  statusCode?: number;
  retryable: boolean;
  providerErrorCode?: string;
  cause?: unknown;
  metadata?: Record<string, unknown>;
};

export class APIProviderError extends Error {
  readonly category: APIErrorCategory;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly providerErrorCode?: string;
  readonly metadata?: Record<string, unknown>;

  constructor(error: NormalizedAPIError) {
    super(error.message);
    this.name = 'APIProviderError';
    this.category = error.category;
    this.statusCode = error.statusCode;
    this.retryable = error.retryable;
    this.providerErrorCode = error.providerErrorCode;
    this.metadata = error.metadata;
    this.cause = error.cause;
  }
}

function categoryFromStatus(statusCode?: number): APIErrorCategory {
  if (statusCode === 401 || statusCode === 403) return 'authentication';
  if (statusCode === 408) return 'timeout';
  if (statusCode === 429) return 'rate_limit';
  if (statusCode === 400 || statusCode === 422) return 'invalid_request';
  if (statusCode === 402) return 'quota';
  if (statusCode && statusCode >= 500) return 'provider_unavailable';
  return 'unknown';
}

function retryableFor(category: APIErrorCategory): boolean {
  return [
    'network',
    'timeout',
    'provider_unavailable',
    'rate_limit',
    'stream_interrupted',
  ].includes(category);
}

export function normalizeAPIError(error: unknown): APIProviderError {
  if (error instanceof APIProviderError) {
    return error;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return new APIProviderError({
      category: 'cancelled',
      message: error.message || 'API request was cancelled.',
      retryable: false,
      cause: error,
    });
  }

  const record = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : {};
  const statusCode = typeof record.statusCode === 'number'
    ? record.statusCode
    : typeof record.status === 'number'
      ? record.status
      : undefined;
  const code = typeof record.code === 'string' ? record.code : undefined;
  const category = code === 'ETIMEDOUT'
    ? 'timeout'
    : code === 'ECONNRESET' || code === 'ENOTFOUND'
      ? 'network'
      : categoryFromStatus(statusCode);
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : 'Unknown API provider error.';

  return new APIProviderError({
    category,
    message,
    statusCode,
    retryable: retryableFor(category),
    providerErrorCode: code,
    cause: error,
  });
}
