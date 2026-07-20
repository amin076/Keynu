import type { ApiErrorPayload } from './contracts';

export interface ApiClientOptions {
  baseUrl?: string;
  defaultTimeoutMs?: number;
  fetchImplementation?: typeof fetch;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeoutMs?: number;
}

export class ApiHttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly endpoint: string;
  readonly payload: ApiErrorPayload | unknown;

  constructor(
    endpoint: string,
    status: number,
    statusText: string,
    payload: ApiErrorPayload | unknown,
  ) {
    const payloadMessage =
      isRecord(payload) && typeof payload.message === 'string'
        ? payload.message
        : isRecord(payload) && typeof payload.error === 'string'
          ? payload.error
          : undefined;

    super(payloadMessage ?? `Request failed with HTTP ${status} ${statusText}`);
    this.name = 'ApiHttpError';
    this.endpoint = endpoint;
    this.status = status;
    this.statusText = statusText;
    this.payload = payload;
  }
}

export class ApiResponseParseError extends Error {
  readonly endpoint: string;
  readonly status: number;
  readonly responsePreview: string;

  constructor(endpoint: string, status: number, responseText: string) {
    super(`The API returned invalid JSON for ${endpoint}.`);
    this.name = 'ApiResponseParseError';
    this.endpoint = endpoint;
    this.status = status;
    this.responsePreview = responseText.slice(0, 500);
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? '');
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  get<TResponse>(endpoint: string, options: ApiRequestOptions = {}): Promise<TResponse> {
    return this.request<TResponse>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  post<TResponse>(
    endpoint: string,
    body?: unknown,
    options: ApiRequestOptions = {},
  ): Promise<TResponse> {
    return this.request<TResponse>(endpoint, {
      ...options,
      method: 'POST',
      body,
    });
  }

  patch<TResponse>(
    endpoint: string,
    body?: unknown,
    options: ApiRequestOptions = {},
  ): Promise<TResponse> {
    return this.request<TResponse>(endpoint, {
      ...options,
      method: 'PATCH',
      body,
    });
  }

  async request<TResponse>(
    endpoint: string,
    options: ApiRequestOptions = {},
  ): Promise<TResponse> {
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    const requestUrl = `${this.baseUrl}${normalizedEndpoint}`;
    const timeoutController = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutHandle = setTimeout(() => timeoutController.abort(), timeoutMs);
    const signal = combineSignals(options.signal, timeoutController.signal);

    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }

    try {
      const response = await this.fetchImplementation(requestUrl, {
        ...options,
        body,
        headers,
        signal,
      });

      const responseText = await response.text();
      const payload = parseJsonResponse(normalizedEndpoint, response.status, responseText);

      if (!response.ok) {
        throw new ApiHttpError(
          normalizedEndpoint,
          response.status,
          response.statusText,
          payload,
        );
      }

      return payload as TResponse;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

export const missionControlApi = new ApiClient();

function parseJsonResponse(endpoint: string, status: number, text: string): unknown {
  if (text.trim() === '') {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiResponseParseError(endpoint, status, text);
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function combineSignals(
  externalSignal: AbortSignal | null | undefined,
  timeoutSignal: AbortSignal,
): AbortSignal {
  if (!externalSignal) {
    return timeoutSignal;
  }

  if (externalSignal.aborted) {
    return externalSignal;
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  externalSignal.addEventListener('abort', abort, { once: true });
  timeoutSignal.addEventListener('abort', abort, { once: true });

  return controller.signal;
}
