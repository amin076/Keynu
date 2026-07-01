import type { RuntimeExecutionResult } from "../core/results/RuntimeExecutionResult.js";

export function createKapSuccessReport(
  jobId: string,
  result?: RuntimeExecutionResult,
): string {
  return [
    "```kap",
    JSON.stringify(
      {
        protocol: "KAP",
        version: "1.0",
        type: "REPORT",
        id: `report-${jobId}`,
        createdAt: new Date().toISOString(),
        payload: {
          jobId,
          status: result?.status ?? "COMPLETED",
          result,
        },
      },
      null,
      2,
    ),
    "```",
  ].join("\n");
}

export function createKapErrorReport(
  jobId: string,
  error: string,
  result?: RuntimeExecutionResult,
): string {
  return [
    "```kap",
    JSON.stringify(
      {
        protocol: "KAP",
        version: "1.0",
        type: "ERROR",
        id: `error-${jobId}`,
        createdAt: new Date().toISOString(),
        payload: {
          jobId,
          status: "FAILED",
          error,
          result,
        },
      },
      null,
      2,
    ),
    "```",
  ].join("\n");
}
