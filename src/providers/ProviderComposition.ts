import { BrowserAgentProvider } from './browser/BrowserAgentProvider.js';
import { ProviderRegistry } from './ProviderRegistry.js';
import type { AIProvider } from './AIProvider.js';

export type ProviderCompositionEnvironment = Record<string, string | undefined>;

export type ProviderCompositionDiagnostic = {
  providerId: string;
  status: 'registered' | 'skipped' | 'invalid';
  message: string;
};

export type ProviderCompositionResult = {
  registry: ProviderRegistry;
  diagnostics: ProviderCompositionDiagnostic[];
};

export type ProviderCompositionOptions = {
  env?: ProviderCompositionEnvironment;
  openAIProviderFactory?: (env: ProviderCompositionEnvironment) => Promise<AIProvider | null> | AIProvider | null;
};

function redactConfiguredSecrets(
  message: string,
  env: ProviderCompositionEnvironment,
): string {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return message;
  return message.split(apiKey).join('<redacted-openai-api-key>');
}

async function loadConfiguredOpenAIProvider(
  env: ProviderCompositionEnvironment,
): Promise<AIProvider | null> {
  const modulePath = './openai/index.js';
  const openAI = await import(modulePath) as {
    loadOpenAIConfigurationFromEnv?: (env: ProviderCompositionEnvironment) => {
      status: 'available' | 'missing' | 'invalid';
      config?: unknown;
      diagnostics: string[];
    };
    OpenAIProvider?: new (options: { config: unknown }) => AIProvider;
  };
  const result = openAI.loadOpenAIConfigurationFromEnv?.(env);

  if (!result || result.status !== 'available' || !result.config || !openAI.OpenAIProvider) {
    return null;
  }

  return new openAI.OpenAIProvider({ config: result.config });
}

export async function createProviderComposition(
  options: ProviderCompositionOptions = {},
): Promise<ProviderCompositionResult> {
  const env = options.env ?? process.env;
  const registry = new ProviderRegistry();
  const diagnostics: ProviderCompositionDiagnostic[] = [];

  registry.register(new BrowserAgentProvider());
  diagnostics.push({
    providerId: 'browser-agent-chatgpt',
    status: 'registered',
    message: 'BrowserAgent provider registered.',
  });

  if (!env.OPENAI_API_KEY?.trim()) {
    diagnostics.push({
      providerId: 'openai-api',
      status: 'skipped',
      message: 'OpenAI provider skipped because OPENAI_API_KEY is not configured.',
    });
    return { registry, diagnostics };
  }

  try {
    const provider = options.openAIProviderFactory
      ? await options.openAIProviderFactory(env)
      : await loadConfiguredOpenAIProvider(env);

    if (!provider) {
      diagnostics.push({
        providerId: 'openai-api',
        status: 'invalid',
        message: 'OpenAI provider configuration is invalid.',
      });
      return { registry, diagnostics };
    }

    registry.register(provider);
    diagnostics.push({
      providerId: provider.id,
      status: 'registered',
      message: 'OpenAI provider registered.',
    });
  } catch (error) {
    diagnostics.push({
      providerId: 'openai-api',
      status: 'invalid',
      message: redactConfiguredSecrets(
        error instanceof Error ? error.message : String(error),
        env,
      ),
    });
  }

  return { registry, diagnostics };
}
