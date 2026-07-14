import { compactCommandResult, compactText } from "../runtime/CompactReport.js";

export const MAX_BROWSER_REPORT_CHARS = 24000;

function compactOperation(operation: any) {
  if (!operation || typeof operation !== "object") return operation;

  return {
    path: operation.path,
    command: operation.command,
    args: Array.isArray(operation.args) ? operation.args : undefined,
    ok: operation.ok,
    blocked: operation.blocked,
    bytes: operation.bytes,
    originalBytes: operation.originalBytes,
    truncated: operation.truncated,
    preview: compactText(operation.preview ?? operation.content, 800),
    output: compactText(operation.stdout, 1200),
    error: compactText(operation.error ?? operation.stderr, 1200),
    artifact: operation.artifact,
  };
}

export function createBrowserReport(report: any): any {
  const payload = report?.payload ?? {};
  const result = payload.result ?? {};

  const compactResult = {
    jobId: result.jobId,
    taskId: result.taskId,
    status: result.status,
    cwd: result.cwd,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    durationMs: result.durationMs,
    reads: Array.isArray(result.reads)
      ? result.reads.map(compactOperation)
      : undefined,
    writes: Array.isArray(result.writes)
      ? result.writes.map(compactOperation)
      : undefined,
    commands: Array.isArray(result.commands)
      ? result.commands.map((item: any) => ({
          ...compactCommandResult(item),
          args: Array.isArray(item?.args) ? item.args : undefined,
          blocked: item?.blocked,
        }))
      : undefined,
    build: result.build ? compactOperation(result.build) : result.build,
    git: result.git
      ? {
          branch: compactOperation(result.git.branch),
          status: compactOperation(result.git.status),
          diffStat: compactOperation(result.git.diffStat),
        }
      : undefined,
    errors: Array.isArray(result.errors)
      ? result.errors.map((item: unknown) => compactText(String(item), 1200))
      : undefined,
  };

  return {
    protocol: report?.protocol ?? "KAP",
    version: report?.version ?? "1.0",
    type: report?.type ?? "REPORT",
    id: report?.id,
    createdAt: report?.createdAt,
    payload: {
      jobId: payload.jobId,
      target: payload.target,
      status: payload.status,
      result: compactResult,
      verification: payload.verification,
      certificate: payload.certificate,
      delivery: {
        mode: "summary",
        fullReportPersisted: true,
      },
    },
  };
}

function wrapKap(serialized: string): string {
  const fence = String.fromCharCode(96).repeat(3);
  return fence + "kap\n" + serialized + "\n" + fence;
}

export function serializeBrowserReport(report: any): string {
  const compactReport = createBrowserReport(report);
  let serialized = JSON.stringify(compactReport, null, 2);

  if (serialized.length <= MAX_BROWSER_REPORT_CHARS) {
    return wrapKap(serialized);
  }

  const payload = compactReport.payload ?? {};
  const result = payload.result ?? {};

  const fallback = {
    ...compactReport,
    payload: {
      ...payload,
      result: {
        jobId: result.jobId,
        taskId: result.taskId,
        status: result.status,
        cwd: result.cwd,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        durationMs: result.durationMs,
        operationCounts: {
          reads: result.reads?.length ?? 0,
          writes: result.writes?.length ?? 0,
          commands: result.commands?.length ?? 0,
        },
        failedCommands: (result.commands ?? [])
          .filter((item: any) => item.ok === false)
          .slice(0, 10),
        errors: (result.errors ?? []).slice(0, 10),
        git: result.git,
      },
      delivery: {
        mode: "minimal-summary",
        fullReportPersisted: true,
        originalCompactCharacters: serialized.length,
      },
    },
  };

  serialized = JSON.stringify(fallback, null, 2);
  return wrapKap(serialized);
}
