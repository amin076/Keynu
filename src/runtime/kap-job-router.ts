import { handlePowerShellKapJob } from "../drivers/powershell/powershell-runtime-adapter.js";

export type KapJob = {
  protocol: "KAP";
  version: string;
  type: "JOB";
  id: string;
  createdAt?: string;
  payload: {
    target: string;
    [key: string]: unknown;
  };
};

export async function routeKapJob(job: KapJob) {
  if (job.protocol !== "KAP" || job.type !== "JOB") {
    throw new Error("Invalid KAP job envelope");
  }

  if (job.payload.target === "powershell") {
    return handlePowerShellKapJob(job as any);
  }

  throw new Error("Unsupported KAP target: " + job.payload.target);
}
