import { pathToFileURL } from 'node:url';
import { createProviderRequest } from '../api/ProviderRequest.js';
import type { ProviderResponse } from '../api/ProviderResponse.js';
import type { ProviderTask } from '../ProviderTask.js';
import {
  loadOpenAIConfigurationFromEnv,
  type OpenAIEnvironment,
} from './OpenAIConfiguration.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import type { OpenAIFetch } from './OpenAITransport.js';

type Writable = {
  write(chunk: string): unknown;
};

export type OpenAISmokeTestOptions = {
  env?: OpenAIEnvironment;
  fetch?: OpenAIFetch;
  stdout?: Writable;
  stderr?: Writable;
};

function line(writer: Writable, message: string): void {
  writer.write(`${message}\n`);
}

function redactConfiguredSecret(
  message: string,
  env: OpenAIEnvironment,
): string {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return message;
  return message.split(apiKey).join('<redacted-openai-api-key>');
}

function usageSummary(response: ProviderResponse): string {
  const usage = response.usage;
  if (!usage) return 'unavailable';

  return [
    `prompt=${usage.promptTokens ?? 0}`,
    `completion=${usage.completionTokens ?? 0}`,
    `total=${usage.totalTokens ?? 0}`,
  ].join(', ');
}

export async function runOpenAISmokeTest(
  options: OpenAISmokeTestOptions = {},
): Promise<number> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const env = options.env ?? process.env;
  const loaded = loadOpenAIConfigurationFromEnv(env);

  if (loaded.status !== 'available') {
    line(stderr, `OpenAI smoke test: FAILED (${loaded.status})`);
    for (const diagnostic of loaded.diagnostics) {
      line(stderr, redactConfiguredSecret(diagnostic, env));
    }
    return 1;
  }

  try {
    const provider = new OpenAIProvider({
      config: {
        ...loaded.config,
        temperature: 0,
        stream: false,
        maxTokens: 16,
        retryCount: loaded.config.retryCount ?? 0,
      },
      transportOptions: options.fetch ? { fetch: options.fetch } : undefined,
    });
    const request = createProviderRequest({
      id: 'openai-smoke-request',
      providerId: provider.id,
      model: loaded.config.model,
      messages: [
        {
          role: 'user',
          content: 'Reply with exactly: OK',
        },
      ],
      parameters: {
        maxOutputTokens: 16,
        temperature: 0,
        stream: false,
      },
      metadata: {
        source: 'keynu-openai-smoke-test',
      },
    });
    const task: ProviderTask = {
      id: 'openai-smoke-test',
      type: 'generate-text',
      providerId: provider.id,
      input: request,
    };
    const result = await provider.execute(task);

    if (result.status !== 'completed') {
      line(stderr, 'OpenAI smoke test: FAILED');
      line(
        stderr,
        redactConfiguredSecret(
          result.error ?? 'OpenAI provider returned a failed result.',
          env,
        ),
      );
      return 1;
    }

    const response = result.output as ProviderResponse;
    line(stdout, 'OpenAI smoke test: PASSED');
    line(stdout, `Status: ${result.status}`);
    line(stdout, `Model: ${response.model ?? loaded.config.model}`);
    line(stdout, `Finish reason: ${response.finishReason ?? 'unknown'}`);
    line(stdout, `Usage: ${usageSummary(response)}`);
    line(stdout, `Text: ${response.content ?? ''}`);
    return 0;
  } catch (error) {
    line(stderr, 'OpenAI smoke test: FAILED');
    line(
      stderr,
      redactConfiguredSecret(
        error instanceof Error ? error.message : String(error),
        env,
      ),
    );
    return 1;
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  process.exitCode = await runOpenAISmokeTest();
}
