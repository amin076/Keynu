import { strict as assert } from 'node:assert';
import {
  loadOpenAIConfigurationFromEnv,
  redactOpenAISecret,
} from '../OpenAIConfiguration.js';

const missing = loadOpenAIConfigurationFromEnv({});
assert.equal(missing.status, 'missing');
assert.match(missing.diagnostics.join('\n'), /OPENAI_API_KEY/);

const missingModel = loadOpenAIConfigurationFromEnv({
  OPENAI_API_KEY: 'sk-env-secret-1234',
});
assert.equal(missingModel.status, 'invalid');
assert.match(missingModel.diagnostics.join('\n'), /OPENAI_MODEL/);
assert.equal(missingModel.diagnostics.join('\n').includes('sk-env-secret-1234'), false);

const invalidInteger = loadOpenAIConfigurationFromEnv({
  OPENAI_API_KEY: 'sk-env-secret-1234',
  OPENAI_MODEL: 'gpt-test',
  OPENAI_TIMEOUT_MS: '-1',
  OPENAI_RETRY_COUNT: 'many',
});
assert.equal(invalidInteger.status, 'invalid');
assert.match(invalidInteger.diagnostics.join('\n'), /OPENAI_TIMEOUT_MS/);
assert.match(invalidInteger.diagnostics.join('\n'), /OPENAI_RETRY_COUNT/);

const available = loadOpenAIConfigurationFromEnv({
  OPENAI_API_KEY: '  sk-env-secret-1234  ',
  OPENAI_MODEL: 'gpt-test',
  OPENAI_BASE_URL: 'https://api.openai.test/v1/responses',
  OPENAI_ORGANIZATION: 'org-test',
  OPENAI_PROJECT: 'project-test',
  OPENAI_TIMEOUT_MS: '5000',
  OPENAI_RETRY_COUNT: '2',
});

assert.equal(available.status, 'available');
if (available.status === 'available') {
  assert.equal(available.config.apiKey, 'sk-env-secret-1234');
  assert.equal(available.config.model, 'gpt-test');
  assert.equal(available.config.endpoint, 'https://api.openai.test/v1/responses');
  assert.equal(available.config.organization, 'org-test');
  assert.equal(available.config.project, 'project-test');
  assert.equal(available.config.timeoutMs, 5000);
  assert.equal(available.config.retryCount, 2);
  assert.equal(available.diagnostics.join('\n').includes('sk-env-secret-1234'), false);
  assert.match(available.diagnostics.join('\n'), /sk-.*1234/);
}

assert.equal(redactOpenAISecret(undefined), '<missing>');
assert.equal(redactOpenAISecret('short'), '<redacted>');
assert.equal(redactOpenAISecret('sk-env-secret-1234'), 'sk-...1234');

console.log('OpenAI environment configuration tests passed.');
