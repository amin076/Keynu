export type TaskPriority = "low" | "normal" | "high";

export type TaskStep = {
  driver: string;
  action: string;
  payload?: unknown;
};

export type Task = {
  id: string;
  createdAt: string;
  priority: TaskPriority;
  steps: TaskStep[];
};

export function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;

  const task = value as Partial<Task>;

  return (
    typeof task.id === "string" &&
    task.id.trim().length > 0 &&
    typeof task.createdAt === "string" &&
    (task.priority === "low" ||
      task.priority === "normal" ||
      task.priority === "high") &&
    Array.isArray(task.steps) &&
    task.steps.every(isTaskStep)
  );
}

export function isTaskStep(value: unknown): value is TaskStep {
  if (!value || typeof value !== "object") return false;

  const step = value as Partial<TaskStep>;

  return (
    typeof step.driver === "string" &&
    step.driver.trim().length > 0 &&
    typeof step.action === "string" &&
    step.action.trim().length > 0
  );
}
