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
}
