export type CodexJobStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface CodexKapJob {
  protocol: "KAP";
  version: "1.0";
  type: "JOB";
  id: string;
  createdAt: string;
  payload: {
    target: "codex";
    projectName?: string;
    repo?: string;
    localPath?: string;
    task: {
      title: string;
      instructions: string[] | string;
      context?: string;
      constraints?: string[];
      avoidChanging?: string[];
    };
    avoidFiles?: string[];
    context?: Record<string, unknown>;
  };
}

export interface CodexParsedResult {
  changedFiles: string[];
  summary: string;
  commandsRun: string[];
  errors: string;
  howToTest: string;
  nextRecommendedStep: string;
  raw: string;
}

export interface CodexKapReport {
  protocol: "KAP";
  version: "1.0";
  type: "REPORT";
  id: string;
  createdAt: string;
  payload: {
    jobId: string;
    target: "codex";
    status: CodexJobStatus;
    manualBridge: true;
    promptPath?: string;
    reportPath?: string;
    result?: CodexParsedResult;
    error?: {
      name: string;
      message: string;
    };
  };
}

export interface CodexPrepareResult {
  jobId: string;
  promptPath: string;
  reportPath: string;
  report: CodexKapReport;
}

export interface CodexPrepareOptions {
  outputRoot?: string;
}

export function isCodexKapJob(value: unknown): value is CodexKapJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const job = value as Partial<CodexKapJob>;
  const payload = job.payload as Partial<CodexKapJob["payload"]> | undefined;
  const task = payload?.task as Partial<CodexKapJob["payload"]["task"]> | undefined;

  return (
    job.protocol === "KAP" &&
    job.version === "1.0" &&
    job.type === "JOB" &&
    typeof job.id === "string" &&
    job.id.trim().length > 0 &&
    typeof job.createdAt === "string" &&
    payload?.target === "codex" &&
    typeof task?.title === "string" &&
    task.title.trim().length > 0 &&
    isInstructionBlock(task.instructions)
  );
}

function isInstructionBlock(value: unknown): value is string[] | string {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((instruction) => typeof instruction === "string")
  );
}
