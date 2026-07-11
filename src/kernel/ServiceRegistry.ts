import type { Service } from './Service.js';

export class ServiceRegistry {
  private readonly services = new Map<string, Service>();

  register(service: Service): void {
    this.services.set(service.id, service);
  }

  get<T extends Service>(id: string): T | undefined {
    return this.services.get(id) as T | undefined;
  }

  list(): Service[] {
    return [...this.services.values()];
  }

  async startAll(): Promise<void> {
    for (const service of this.services.values()) {
      await service.start?.();
    }
  }

  async stopAll(): Promise<void> {
    const list = [...this.services.values()].reverse();
    for (const service of list) {
      await service.stop?.();
    }
  }
}
