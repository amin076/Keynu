import { runPowerShellFileOps } from "./powershell-fileops.js";
import type { KapJob, KapReport, PowerShellFileOpsJobPayload } from "./powershell-types.js";

export async function runPowerShellRuntimeJob(
  job: KapJob<PowerShellFileOpsJobPayload>,
): Promise<KapReport> {
  const result = await runPowerShellFileOps(job.id, job.payload);

  return {
    protocol: "KAP",
    version: job.version ?? "1.0",
    type: "REPORT",
    id: `report-${job.id}`,
    createdAt: new Date().toISOString(),
    payload: {
      jobId: job.id,
      target: "powershell",
      status: result.status,
      result,
    },
  };
}
