import { CapabilityRegistry } from "./CapabilityRegistry.js";
import { CommandBus } from "./CommandBus.js";
import { CommandQueue } from "./CommandQueue.js";
import { DriverManager } from "./DriverManager.js";
import { Runtime } from "./Runtime.js";
import { registerBuiltinDrivers } from "./registerBuiltinDrivers.js";

export class Agent {
  private readonly driverManager = new DriverManager();

  private readonly capabilityRegistry = new CapabilityRegistry();

  private readonly commandBus = new CommandBus(
    this.driverManager,
    this.capabilityRegistry,
  );

  private readonly queue = new CommandQueue();

  private readonly runtime = new Runtime(this.commandBus);

  async start() {
    console.log("");
    console.log("======================");
    console.log("Keynu");
    console.log("======================");
    console.log("");

    await registerBuiltinDrivers(this.driverManager, this.capabilityRegistry);

    console.log("Watching inbox...");
    console.log("");

    while (true) {
      const task = await this.queue.next();

      if (task) {
        console.log("");
        console.log("Running Task:", task.id);
        console.log("");

        await this.runtime.execute(task);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}


