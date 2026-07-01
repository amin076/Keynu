import { CommandBus } from "./CommandBus.js";
import { CommandQueue } from "./CommandQueue.js";
import { DriverManager } from "./DriverManager.js";
import { Runtime } from "./Runtime.js";
import { registerBuiltinDrivers } from "./registerBuiltinDrivers.js";

export class Agent {
  private readonly driverManager = new DriverManager();
  private readonly commandBus = new CommandBus(this.driverManager);
  private readonly queue = new CommandQueue();
  private readonly runtime = new Runtime(this.commandBus);

  async start(): Promise<void> {
    console.log("");
    console.log("======================");
    console.log("Keynu");
    console.log("======================");
    console.log("");

    await registerBuiltinDrivers(this.driverManager);

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

      await sleep(500);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
