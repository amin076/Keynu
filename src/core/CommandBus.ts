import { DriverManager } from "./DriverManager.js";
import type { TaskStep } from "../models/Task.js";

export type AgentCommand = TaskStep;

export class CommandBus {
  constructor(private readonly drivers: DriverManager) {}

  async execute(command: AgentCommand): Promise<void> {
    this.validateCommand(command);

    const driver = this.drivers.get(command.driver);

    if (!driver) {
      throw new Error(`Driver '${command.driver}' not found.`);
    }

    await driver.execute(command);
  }

  private validateCommand(command: AgentCommand): void {
    if (!command || typeof command !== "object") {
      throw new Error("Command is required.");
    }

    if (!command.driver || typeof command.driver !== "string") {
      throw new Error("Command driver must be a non-empty string.");
    }

    if (!command.action || typeof command.action !== "string") {
      throw new Error("Command action must be a non-empty string.");
    }
  }
}
