import type { IncomingMessage, ServerResponse } from "node:http";

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body, null, 2));
}

export type DashboardMemorySummary = {
  id: string;
  category: string;
  missionId: string | null;
  status: string | null;
  updatedAt: string | null;
  resumeTokenPresent: boolean;
  autonomousStep: number | null;
  keyCount: number;
  sourcePath: string;
};

export type DashboardReportSummary = {
  id: string;
  jobId: string;
  type: string;
  status: string;
  createdAt: string;
  target: string;
  verificationStatus: string | null;
  certificateStatus: string | null;
  sourcePath: string;
};

export type DashboardGitCommit = { hash: string; shortHash: string; author: string; authoredAt: string; subject: string; };

export type DashboardGitFile = { indexStatus: string; workTreeStatus: string; path: string; };

export type DashboardGitSummary = { branch: string; detached: boolean; clean: boolean; stagedCount: number; modifiedCount: number; untrackedCount: number; files: DashboardGitFile[]; recentCommits: DashboardGitCommit[]; };

export type DashboardProcessSummary = {
  pid: number;
  parentPid: number | null;
  name: string;
  commandLine: string;
  status: string;
};

export type DashboardDriverSummary = {
  id: string;
  name: string;
  status: string;
  capabilities: string[];
};

export type DashboardApiContext = {
  getMemory?: () => Promise<DashboardMemorySummary[]> | DashboardMemorySummary[];
  getReports?: () => Promise<DashboardReportSummary[]> | DashboardReportSummary[];
  getGitSummary?: () => Promise<DashboardGitSummary> | DashboardGitSummary;
  getProcesses?: () => Promise<DashboardProcessSummary[]> | DashboardProcessSummary[];
  getDrivers?: () => DashboardDriverSummary[];
};

export async function handleDashboardApi(
  request: IncomingMessage,
  response: ServerResponse,
  context: DashboardApiContext = {},
): Promise<boolean> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (request.method === "GET" && url.pathname === "/api/memory") {
    const memory = await context.getMemory?.() ?? [];
    sendJson(response, 200, { ok: true, count: memory.length, memory, time: new Date().toISOString() });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/reports") {
    const reports = await context.getReports?.() ?? [];
    sendJson(response, 200, { ok: true, count: reports.length, reports, time: new Date().toISOString() });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/git") {
    const git = await context.getGitSummary?.();
    if (!git) { sendJson(response, 503, { ok: false, error: "Git telemetry is unavailable." }); return true; }
    sendJson(response, 200, { ok: true, git, time: new Date().toISOString() });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/processes") {
    const processes = await context.getProcesses?.() ?? [];
    sendJson(response, 200, { ok: true, count: processes.length, processes, time: new Date().toISOString() });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/drivers") {
    const drivers = context.getDrivers?.() ?? [];
    sendJson(response, 200, { ok: true, count: drivers.length, drivers, time: new Date().toISOString() });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/dashboard/status") {
    sendJson(response, 200, {
      ok: true,
      service: "keynu-dashboard-api",
      status: "online",
      time: new Date().toISOString(),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/browser/status") {
    sendJson(response, 200, {
      ok: true,
      browser: "managed-by-keynu-browser-agent",
      remoteDebuggingPort: 9222,
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/projects") {
    sendJson(response, 200, { ok: true, projects: [] });
    return true;
  }

  return false;
}
