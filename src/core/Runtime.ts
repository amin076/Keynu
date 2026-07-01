import { CommandBus } from "./CommandBus.js";
import type { Task } from "../models/Task.js";

export type RuntimeResult = {
  taskId: string;
  status: "completed" | "failed";
  startedAt: string;
  finishedAt: string;
  stepsRun: number;
  error?: string;
};

export class Runtime {
  constructor(private readonly commandBus: CommandBus) {}

  async execute(task: Task): Promise<RuntimeResult> {
    const startedAt = new Date().toISOString();
    let stepsRun = 0;

    try {
      for (const step of task.steps) {
        await this.commandBus.execute(step);
        stepsRun += 1;
      }

      return {
        taskId: task.id,
        status: "completed",
        startedAt,
        finishedAt: new Date().toISOString(),
        stepsRun,
      };
    } catch (error) {
      return {
        taskId: task.id,
        status: "failed",
        startedAt,
        finishedAt: new Date().toISOString(),
        stepsRun,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
