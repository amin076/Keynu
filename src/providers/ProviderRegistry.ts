import type { AIProvider } from './AIProvider.js';
import type { ProviderCapabilityName } from './ProviderCapabilities.js';

export class ProviderRegistry {
  private readonly providers = new Map<string, AIProvider>();

  register(provider: AIProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`AI provider '${provider.id}' is already registered.`);
    }

    this.providers.set(provider.id, provider);
  }

  get(providerId: string): AIProvider {
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new Error(`AI provider '${providerId}' was not found.`);
    }

    return provider;
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  list(): AIProvider[] {
    return [...this.providers.values()];
  }

  findByCapability(capability: ProviderCapabilityName): AIProvider[] {
    return this.list().filter((provider) =>
      provider.capabilities.capabilities.includes(capability),
    );
  }
}
