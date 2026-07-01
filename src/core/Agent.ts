import { CommandBus } from "./CommandBus.js";
import { CommandQueue } from "./CommandQueue.js";
import { DriverManager } from "./DriverManager.js";
import { registerBuiltinDrivers } from "./registerBuiltinDrivers.js";

export class Agent {
  private readonly driverManager = new DriverManager();

  private readonly commandBus = new CommandBus(this.driverManager);

  private readonly queue = new CommandQueue();

  async start() {
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

    for (const step of task.steps) {

        await this.commandBus.execute(step);

    }

}

      await new Promise((resolve) =>
        setTimeout(resolve, 500),
      );
    }
  }
}