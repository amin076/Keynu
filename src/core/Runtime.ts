import { CommandBus } from "./CommandBus.js";
import type { Task } from "../models/Task.js";
import type {
  RuntimeExecutionResult,
  StepExecutionResult,
} from "./results/RuntimeExecutionResult.js";

export class Runtime {
  constructor(private readonly commandBus: CommandBus) {}

  async execute(task: Task): Promise<RuntimeExecutionResult> {
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const steps: StepExecutionResult[] = [];

    for (let index = 0; index < task.steps.length; index += 1) {
      const command = task.steps[index];
      const stepStartedAtMs = Date.now();
      const stepStartedAt = new Date(stepStartedAtMs).toISOString();

      try {
        const commandResult = await this.commandBus.execute(command);

        const stepFinishedAtMs = Date.now();

        steps.push({
          index,
          status: "COMPLETED",
          startedAt: stepStartedAt,
          finishedAt: new Date(stepFinishedAtMs).toISOString(),
          durationMs: stepFinishedAtMs - stepStartedAtMs,
          command,
          result: commandResult,
        });
      } catch (error) {
        const stepFinishedAtMs = Date.now();
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        steps.push({
          index,
          status: "FAILED",
          startedAt: stepStartedAt,
          finishedAt: new Date(stepFinishedAtMs).toISOString(),
          durationMs: stepFinishedAtMs - stepStartedAtMs,
          command,
          error: errorMessage,
        });

        const finishedAtMs = Date.now();

        return {
          taskId: task.id,
          status: "FAILED",
          startedAt,
          finishedAt: new Date(finishedAtMs).toISOString(),
          durationMs: finishedAtMs - startedAtMs,
          stepsRun: steps.length,
          steps,
          error: errorMessage,
        };
      }
    }

    const finishedAtMs = Date.now();

    return {
      taskId: task.id,
      status: "COMPLETED",
      startedAt,
      finishedAt: new Date(finishedAtMs).toISOString(),
      durationMs: finishedAtMs - startedAtMs,
      stepsRun: steps.length,
      steps,
    };
  }
}
