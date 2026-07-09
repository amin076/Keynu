import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runPowerShellPatchJob, type PowerShellPatchJob } from "./powershell-patch.js";
import { handleProcessManagerPayload } from "./process-manager/process-manager-adapter.js";

export async function handlePowerShellKapJob(job: PowerShellPatchJob) {
  const processResult = await handleProcessManagerPayload((job as any).payload);

  if (processResult) {
    return {
      protocol: "KAP",
      version: job.version ?? "1.0",
      type: "REPORT",
      id: "report-" + job.id,
      createdAt: new Date().toISOString(),
      payload: {
        jobId: job.id,
        target: "powershell",
        status: "COMPLETED",
        result: processResult,
      },
    };
  }

  const report = await runPowerShellPatchJob(job);
  const cwd = job.payload.cwd;
  const reportDir = join(cwd, ".keynu", "powershell", "reports");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, job.id + ".runtime.report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
