import { APIProviderError } from '../api/APIError.js';

export async function openAIHttpError(response: Response): Promise<APIProviderError> {
  let message = response.statusText, code: string | undefined;
  try {
    const body = await response.json() as { error?: { message?: string; code?: string; type?: string } };
    message = body.error?.message ?? message; code = body.error?.code ?? body.error?.type;
  } catch { /* Non-JSON upstream error retains HTTP status. */ }
  const quota = code === 'insufficient_quota' || /(?:spend|usage)_limit_exceeded$/.test(code ?? '');
  const category = quota || response.status === 402 ? 'quota'
    : response.status === 401 || response.status === 403 ? 'authentication'
    : response.status === 408 ? 'timeout'
    : response.status === 429 ? 'rate_limit'
    : response.status === 400 || response.status === 422 ? 'invalid_request'
    : response.status >= 500 ? 'provider_unavailable' : 'internal_provider_error';
  const retryAfter = response.headers.get('retry-after');
  const delay = retryAfter === null ? undefined : /^\d+(\.\d+)?$/.test(retryAfter)
    ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now());
  return new APIProviderError({ category, message, statusCode: response.status, providerErrorCode: code,
    retryable: !quota && (response.status === 429 || response.status === 408 || response.status >= 500),
    metadata: Number.isFinite(delay) ? { retryAfterMs: delay } : undefined });
}
