import type { APIConfig } from '../api/APIConfig.js';

export const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';

export type OpenAIConfiguration = {
  endpoint?: string;
  apiKey: string;
  organization?: string;
  project?: string;
  model: string;
  timeoutMs?: number;
  retryCount?: number;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stream?: boolean;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
};

export type OpenAIEnvironment = Record<string, string | undefined>;

export type OpenAIConfigurationLoadResult =
  | {
      status: 'available';
      config: OpenAIConfiguration;
      diagnostics: string[];
    }
  | {
      status: 'missing';
      diagnostics: string[];
    }
  | {
      status: 'invalid';
      diagnostics: string[];
    };

function parseOptionalInteger(
  env: OpenAIEnvironment,
  name: string,
  diagnostics: string[],
): number | undefined {
  const value = env[name];
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    diagnostics.push(`${name} must be a non-negative integer.`);
    return undefined;
  }

  return parsed;
}

export function redactOpenAISecret(value: string | undefined): string {
  if (!value) return '<missing>';
  if (value.length <= 8) return '<redacted>';
  return `${value.slice(0, 3)}...${value.slice(-4)}`;
}

export function loadOpenAIConfigurationFromEnv(
  env: OpenAIEnvironment = process.env,
): OpenAIConfigurationLoadResult {
  const diagnostics: string[] = [];
  const apiKey = env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return {
      status: 'missing',
      diagnostics: ['OPENAI_API_KEY is not configured.'],
    };
  }

  const model = env.OPENAI_MODEL?.trim();
  if (!model) {
    diagnostics.push('OPENAI_MODEL is required when OPENAI_API_KEY is set.');
  }

  const timeoutMs = parseOptionalInteger(env, 'OPENAI_TIMEOUT_MS', diagnostics);
  const retryCount = parseOptionalInteger(env, 'OPENAI_RETRY_COUNT', diagnostics);

  if (diagnostics.length > 0) {
    return {
      status: 'invalid',
      diagnostics,
    };
  }

  return {
    status: 'available',
    diagnostics: [
      `OpenAI configuration loaded for model '${model}'. API key ${redactOpenAISecret(apiKey)}.`,
    ],
    config: {
      apiKey,
      model: model!,
      endpoint: env.OPENAI_BASE_URL?.trim() || undefined,
      organization: env.OPENAI_ORGANIZATION?.trim() || undefined,
      project: env.OPENAI_PROJECT?.trim() || undefined,
      timeoutMs,
      retryCount,
    },
  };
}

export function createOpenAIAPIConfig(
  config: OpenAIConfiguration,
): APIConfig {
  if (!config.apiKey.trim()) {
    throw new Error('OpenAI apiKey is required.');
  }

  if (!config.model.trim()) {
    throw new Error('OpenAI model is required.');
  }

  return {
    providerId: 'openai-api',
    providerName: 'OpenAI API',
    endpoint: config.endpoint ?? DEFAULT_OPENAI_ENDPOINT,
    apiKey: config.apiKey,
    organization: config.organization,
    project: config.project,
    model: config.model,
    timeoutMs: config.timeoutMs,
    retryCount: config.retryCount,
    temperature: config.temperature,
    topP: config.topP,
    stream: config.stream,
    headers: config.headers,
    metadata: {
      ...(config.metadata ?? {}),
      maxTokens: config.maxTokens,
    },
  };
}
