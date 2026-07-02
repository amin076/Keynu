import type { AgentCommand } from "../../core/CommandBus.js";
import { Driver } from "../Driver.js";
import type { DriverCapability } from "../DriverCapability.js";
import type { DriverContext } from "../DriverContext.js";
import type { DriverMetadata } from "../DriverMetadata.js";
import type { DriverResult } from "../DriverResult.js";
import type { LegacyDriver } from "./LegacyDriver.js";

export class LegacyDriverAdapter extends Driver {
  readonly metadata: DriverMetadata;

  constructor(
    private readonly legacy: LegacyDriver,
    private readonly legacyCapabilities: DriverCapability[],
  ) {
    super();

    this.metadata = {
      id: legacy.name,
      name: legacy.name,
      version: "legacy",
      description: `Legacy driver adapter for ${legacy.name}`,
    };
  }

  capabilities(): DriverCapability[] {
    return this.legacyCapabilities;
  }

  async initialize(): Promise<void> {
    await this.legacy.initialize?.();
  }

  async shutdown(): Promise<void> {
    await this.legacy.shutdown?.();
  }

  async execute(
    capability: string,
    payload: unknown,
    _context: DriverContext,
  ): Promise<DriverResult> {
    const command: AgentCommand = {
      driver: this.legacy.name,
      action: capability,
      payload,
    };

    try {
      await this.legacy.execute(command);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
