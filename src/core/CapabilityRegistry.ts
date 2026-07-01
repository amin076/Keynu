export interface Capability {
  name: string;
  driver: string;
  action: string;
}

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, Capability>();

  register(capability: Capability): void {
    this.capabilities.set(capability.name, capability);
  }

  get(name: string): Capability | undefined {
    return this.capabilities.get(name);
  }

  has(name: string): boolean {
    return this.capabilities.has(name);
  }

  getAll(): Capability[] {
    return [...this.capabilities.values()];
  }

  clear(): void {
    this.capabilities.clear();
  }
}