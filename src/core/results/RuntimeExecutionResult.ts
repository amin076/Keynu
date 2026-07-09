export type StepExecutionStatus = "COMPLETED" | "FAILED";

export type StepExecutionResult = {
  index: number;
  status: StepExecutionStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  command: unknown;
  error?: string;
};

export type RuntimeExecutionStatus = "COMPLETED" | "FAILED";

export type RuntimeExecutionResult = {
  taskId: string;
  status: RuntimeExecutionStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  stepsRun: number;
  steps: StepExecutionResult[];
  error?: string;
};
