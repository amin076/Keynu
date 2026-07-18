import { strict as assert } from 'node:assert';
import {
  APIProviderError,
  normalizeAPIError,
} from '../api/APIError.js';

const auth = normalizeAPIError({
  statusCode: 401,
  message: 'Unauthorized',
});
assert.equal(auth.category, 'authentication');
assert.equal(auth.retryable, false);

const rateLimit = normalizeAPIError({
  status: 429,
  code: 'rate_limited',
});
assert.equal(rateLimit.category, 'rate_limit');
assert.equal(rateLimit.retryable, true);

const network = normalizeAPIError({
  code: 'ECONNRESET',
});
assert.equal(network.category, 'network');
assert.equal(network.retryable, true);

const timeout = normalizeAPIError({
  code: 'ETIMEDOUT',
});
assert.equal(timeout.category, 'timeout');
assert.equal(timeout.retryable, true);

const existing = new APIProviderError({
  category: 'quota',
  message: 'Quota exceeded',
  retryable: false,
});
assert.equal(normalizeAPIError(existing), existing);

const abort = new Error('cancelled');
abort.name = 'AbortError';
assert.equal(normalizeAPIError(abort).category, 'cancelled');

console.log('API error tests passed.');
