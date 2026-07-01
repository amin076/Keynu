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

  async start(): Promise<void> {
    console.log("");
    console.log("======================");
    console.log("Keynu");
    console.log("======================");
    console.log("");

    await registerBuiltinDrivers(this.driverManager, this.capabilityRegistry);

    console.log("Capabilities:");
    for (const capability of this.capabilityRegistry.getAll()) {
      console.log(`- ${capability.name} -> ${capability.driver}.${capability.action}`);
    }

    console.log("");
    console.log("Watching inbox...");
    console.log("");

    while (true) {
      const task = await this.queue.next();

      if (task) {
        console.log("");
        console.log("Running Task:", task.id);
        console.log("");

        const result = await this.runtime.execute(task);

        if (result.status === "completed") {
          console.log(`Task completed: ${result.taskId} (${result.stepsRun} steps)`);
        } else {
          console.error(`Task failed: ${result.taskId}`);
          console.error(result.error);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
