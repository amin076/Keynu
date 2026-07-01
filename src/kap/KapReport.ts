export function createKapSuccessReport(jobId: string): string {
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
          status: "COMPLETED",
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
        },
      },
      null,
      2,
    ),
    "```",
  ].join("\n");
}
