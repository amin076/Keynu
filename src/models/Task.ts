export type TaskStep = {
  driver: string;
  action: string;
  payload?: unknown;
};

export type Task = {
  id: string;
  createdAt: string;
  priority: "low" | "normal" | "high";
  steps: TaskStep[];
};