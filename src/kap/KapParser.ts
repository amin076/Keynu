import type { Task } from "../models/Task.js";
import { isTask } from "../models/Task.js";
import { isKapJobEnvelope, taskFromKapJob } from "./KapEnvelope.js";

export type ParsedQueueItem = {
  task: Task;
  source: "task" | "kap";
};

export function parseQueueItem(value: unknown): ParsedQueueItem | null {
  if (isTask(value)) {
    return {
      task: value,
      source: "task",
    };
  }

  if (isKapJobEnvelope(value)) {
    const task = taskFromKapJob(value);

    if (!isTask(task)) {
      return null;
    }

    return {
      task,
      source: "kap",
    };
  }

  return null;
}
