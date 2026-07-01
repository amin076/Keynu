import { CapabilityRegistry } from "./CapabilityRegistry.js";
import { DriverManager } from "./DriverManager.js";

export type LegacyAgentCommand = {
  driver: string;
  action: string;
  payload?: unknown;
};

export type CapabilityAgentCommand = {
  capability: string;
  payload?: unknown;
};

export type AgentCommand = LegacyAgentCommand | CapabilityAgentCommand;

export class CommandBus {
  constructor(
    private readonly drivers: DriverManager,
    private readonly capabilities?: CapabilityRegistry,
  ) {}

  async execute(command: AgentCommand): Promise<void> {
    const resolvedCommand = this.resolveCommand(command);

    const driver = this.drivers.get(resolvedCommand.driver);

    if (!driver) {
      throw new Error(`Driver '${resolvedCommand.driver}' not found.`);
    }

    await driver.execute(resolvedCommand);
  }

  private resolveCommand(command: AgentCommand): LegacyAgentCommand {
    this.validateCommand(command);

    if ("capability" in command) {
      if (!this.capabilities) {
        throw new Error(
          "Capability command received, but CapabilityRegistry is not configured.",
        );
      }

      const capability = this.capabilities.get(command.capability);

      if (!capability) {
        throw new Error(`Capability '${command.capability}' not found.`);
      }

      return {
        driver: capability.driver,
        action: capability.action,
        payload: command.payload,
      };
    }

    return command;
  }

  private validateCommand(command: AgentCommand): void {
    if (!command || typeof command !== "object") {
      throw new Error("Command must be an object.");
    }

    if ("capability" in command) {
      if (!command.capability || typeof command.capability !== "string") {
        throw new Error("Command capability must be a non-empty string.");
      }

      return;
    }

    if (!command.driver || typeof command.driver !== "string") {
      throw new Error("Command driver must be a non-empty string.");
    }

    if (!command.action || typeof command.action !== "string") {
      throw new Error("Command action must be a non-empty string.");
    }
  }
}
