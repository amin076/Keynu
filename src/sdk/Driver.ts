import type { DriverCapability } from "./DriverCapability.js";
import type { DriverContext } from "./DriverContext.js";
import type { DriverMetadata } from "./DriverMetadata.js";
import type { DriverResult } from "./DriverResult.js";

export abstract class Driver {
  abstract readonly metadata: DriverMetadata;

  abstract capabilities(): DriverCapability[];

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  abstract execute(
    capability: string,
    payload: unknown,
    context: DriverContext,
  ): Promise<DriverResult>;
}