import { DriverManager } from "./DriverManager.js";

export type AgentCommand = {
  driver: string;
  action: string;
  payload?: unknown;
};

export class CommandBus {
  constructor(
    private readonly drivers: DriverManager,
  ) {}

  async execute(command: AgentCommand) {
    const driver = this.drivers.get(command.driver);

    if (!driver) {
      throw new Error(
        `Driver '${command.driver}' not found.`,
      );
    }

    await driver.execute(command);
  }
}