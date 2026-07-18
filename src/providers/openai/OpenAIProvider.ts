import { APIProvider } from '../api/APIProvider.js';
import type { ProviderCapabilities } from '../ProviderCapabilities.js';
import {
  createOpenAIAPIConfig,
  type OpenAIConfiguration,
} from './OpenAIConfiguration.js';
import { OpenAITransport, type OpenAITransportOptions } from './OpenAITransport.js';

export type OpenAIProviderOptions = {
  config: OpenAIConfiguration;
  transport?: OpenAITransport;
  transportOptions?: OpenAITransportOptions;
};

export class OpenAIProvider extends APIProvider {
  override readonly capabilities: ProviderCapabilities = {
    transport: 'api',
    capabilities: ['text.generate'],
    supportsMissionBootstrap: false,
    supportsKap: false,
    supportsContinuation: false,
    supportsInteractiveSession: false,
  };

  constructor(options: OpenAIProviderOptions) {
    super({
      config: createOpenAIAPIConfig(options.config),
      transport:
        options.transport ??
        new OpenAITransport(options.transportOptions),
    });
  }
}
