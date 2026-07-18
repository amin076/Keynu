import type { NormalizedAPIConfig } from '../api/APIConfig.js';

export function createOpenAIAuthenticationHeaders(
  config: NormalizedAPIConfig,
): Record<string, string> {
  if (!config.apiKey?.trim()) {
    throw new Error('OpenAI API key is required.');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
  };

  if (config.organization) {
    headers['OpenAI-Organization'] = config.organization;
  }

  if (config.project) {
    headers['OpenAI-Project'] = config.project;
  }

  return headers;
}
