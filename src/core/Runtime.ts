import { CommandBus } from "./CommandBus.js";
import type { Task } from "../models/Task.js";

export class Runtime {
  constructor(private readonly commandBus: CommandBus) {}

  async execute(task: Task): Promise<void> {
    for (const step of task.steps) {
      await this.commandBus.execute(step);
    }
  }
}
