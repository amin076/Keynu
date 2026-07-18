import type { Driver } from "./Driver.js";

export class DriverManager {
  private readonly drivers = new Map<string, Driver>();

  register(driver: Driver): void {
    if (this.drivers.has(driver.id)) {
      throw new Error(`Driver '${driver.id}' is already registered.`);
    }

    this.drivers.set(driver.id, driver);
    console.log(`Driver registered: ${driver.id}`);
  }

  async initialize(): Promise<void> {
    for (const driver of this.drivers.values()) {
      await driver.initialize();
    }
  }

  get(id: string): Driver | undefined {
    return this.drivers.get(id);
  }

  list(): string[] {
    return [...this.drivers.keys()].sort();
  }

  getDriverSummaries(): Array<{ id: string; name: string; status: string; capabilities: string[] }> {
    return Array.from(this.drivers.entries()).map(([id, driver]) => {
      const record = driver as unknown as Record<string, unknown>;
      return {
        id: String(id),
        name: String(record.name ?? id),
        status: String(record.status ?? (record.ready === false ? "Unavailable" : "Registered")),
        capabilities: Array.isArray(record.capabilities) ? record.capabilities.map(String) : [],
      };
    });
  }
}
