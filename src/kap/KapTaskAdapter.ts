import type { Task } from "../models/Task.js";
import type { KapJob } from "../runtime/kap-job-router.js";

export function kapJobToTask(job: KapJob): Task {
  const steps = (job.payload as any).steps;

  if (!Array.isArray(steps)) {
    throw new Error("KAP JOB cannot convert to Task: payload.steps is missing or invalid");
  }

  return {
    id: job.id,
    createdAt: job.createdAt ?? new Date().toISOString(),
    priority: "normal",
    steps,
  };
}
