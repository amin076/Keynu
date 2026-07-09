export interface Capability {
  readonly name: string;
  readonly driver: string;
  readonly action: string;
  readonly description?: string;
}

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, Capability>();

  register(capability: Capability): void {
    if (!capability.name.trim()) {
      throw new Error("Capability name must be a non-empty string.");
    }

    if (!capability.driver.trim()) {
      throw new Error(`Capability '${capability.name}' driver must be a non-empty string.`);
    }

    if (!capability.action.trim()) {
      throw new Error(`Capability '${capability.name}' action must be a non-empty string.`);
    }

    if (this.capabilities.has(capability.name)) {
      throw new Error(`Capability '${capability.name}' is already registered.`);
    }

    this.capabilities.set(capability.name, capability);
  }

  get(name: string): Capability | undefined {
    return this.capabilities.get(name);
  }

  has(name: string): boolean {
    return this.capabilities.has(name);
  }

  getAll(): Capability[] {
    return [...this.capabilities.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  clear(): void {
    this.capabilities.clear();
  }
}
