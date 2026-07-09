import { routeKapJob, type KapJob } from "../runtime/kap-job-router.js";

export type BrowserRuntimeBridgeOptions = {
  dedupe?: boolean;
};

const processedJobIds = new Set<string>();

export function resetBrowserRuntimeBridgeDedupe() {
  processedJobIds.clear();
}

export function extractKapJobsFromText(text: string): KapJob[] {
  const jobs: KapJob[] = [];
  const seen = new Set<string>();
  const fencedBlockRegex = /```kap\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = fencedBlockRegex.exec(text)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.protocol === "KAP" && parsed?.type === "JOB" && parsed?.id && !seen.has(parsed.id)) {
        seen.add(parsed.id);
        jobs.push(parsed);
      }
    } catch {
      // Ignore invalid fenced JSON blocks.
    }
  }

  if (jobs.length > 0) return jobs;

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const raw = text.slice(firstBrace, lastBrace + 1).trim();
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.protocol === "KAP" && parsed?.type === "JOB" && parsed?.id) {
        jobs.push(parsed);
      }
    } catch {
      // Ignore non-JSON messages.
    }
  }

  return jobs;
}

export function formatKapReportForChat(report: unknown) {
  return "```kap\n" + JSON.stringify(report, null, 2) + "\n```";
}

export async function processBrowserMessageForKapJobs(
  messageText: string,
  options: BrowserRuntimeBridgeOptions = {}
) {
  const dedupe = options.dedupe !== false;
  const jobs = extractKapJobsFromText(messageText);
  const reports: string[] = [];

  for (const job of jobs) {
    if (dedupe && processedJobIds.has(job.id)) {
      continue;
    }

    if (dedupe) {
      processedJobIds.add(job.id);
    }

    const report = await routeKapJob(job);
    reports.push(formatKapReportForChat(report));
  }

  return reports.join("\n\n");
}
