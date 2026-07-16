import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { renderDashboardHtml } from "./dashboardHtml.js";
import { handleDashboardApi } from "./dashboardApi.js";
import { getDashboardBrowser, getDashboardRuntime, readDashboardSession } from "./dashboardSession.js";
import type { Capability } from "../core/CapabilityRegistry.js";
import type { DriverManager } from "../core/DriverManager.js";
import { handleProcessManagerPayload } from "../drivers/powershell/process-manager/process-manager-adapter.js";
import { MissionManager } from "../mission/MissionManager.js";
import { GraphQueryService } from "../graph/GraphQueryService.js";
import { GraphEventStore } from "../graph/GraphEventStore.js";
import { EffectiveGraphQueryService } from "../graph/EffectiveGraphQueryService.js";
import { RuntimeGraphIntelligence } from "../graph/RuntimeGraphIntelligence.js";
import { OperationalInsightsService } from "../graph/OperationalInsightsService.js";
export type DashboardServerHandle = {
  server: Server;
  host: string;
  port: number;
  url: string;
  close(): Promise<void>;
};


export type DashboardServerOptions = {
  driverManager: DriverManager;
  capabilities: Capability[];
  port?: number;
  graphQueryService?: GraphQueryService;
  graphEventStore?: GraphEventStore;
  effectiveGraphQueryService?: EffectiveGraphQueryService;
  operationalInsightsService?: OperationalInsightsService;
};

type JsonValue = Record<string, unknown> | unknown[];
type DashboardEvent = { time: string; type: string; message: string };
type HistoryFile = {
  name: string;
  path: string;
  relativePath: string;
  modifiedAt: string;
  bytes: number;
  data: unknown;
};

type HistorySnapshot = {
  reports: HistoryFile[];
  processed: HistoryFile[];
  failed: HistoryFile[];
  jobs: HistoryFile[];
};

const recentEvents: DashboardEvent[] = [];
let refreshCount = 0;
let lastHistorySignature = "";

function pushEvent(type: string, message: string): void {
  const latest = recentEvents[0];
  if (latest?.type === type && latest.message === message) return;
  recentEvents.unshift({ time: new Date().toISOString(), type, message });
  recentEvents.splice(80);
}

function sendJson(response: ServerResponse, statusCode: number, body: JsonValue): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body, null, 2));
}

function sendHtml(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(body);
}

function sendJavaScript(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "content-type": "text/javascript; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(body);
}

function getPath(request: IncomingMessage): string {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  return url.pathname;
}

function getUptimeSeconds(startedAtMs: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
}

function isPortInUseError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "EADDRINUSE";
}

function readJsonFileSafe(fullPath: string): unknown {
  try {
    return JSON.parse(readFileSync(fullPath, "utf8"));
  } catch {
    return null;
  }
}

function readRecentJsonFiles(dirPath: string, limit = 20): HistoryFile[] {
  if (!existsSync(dirPath)) return [];

  return readdirSync(dirPath)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const fullPath = join(dirPath, name);
      const stat = statSync(fullPath);
      return {
        name,
        path: fullPath,
        relativePath: relative(process.cwd(), fullPath),
        modifiedAt: stat.mtime.toISOString(),
        bytes: stat.size,
        data: readJsonFileSafe(fullPath),
      };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    .slice(0, limit);
}

function getHistorySnapshot(): HistorySnapshot {
  return {
    reports: readRecentJsonFiles(join(process.cwd(), ".keynu", "powershell", "reports"), 40),
    processed: readRecentJsonFiles(join(process.cwd(), "processed"), 30),
    failed: readRecentJsonFiles(join(process.cwd(), "failed"), 30),
    jobs: readRecentJsonFiles(join(process.cwd(), ".keynu", "powershell", "jobs"), 30),
  };
}

function getValueAtPath(source: unknown, path: string[]): unknown {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function getStringAtPath(source: unknown, path: string[], fallback = "--"): string {
  const value = getValueAtPath(source, path);
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getLatestReport(history: HistorySnapshot): HistoryFile | null {
  return history.reports[0] ?? history.processed[0] ?? history.failed[0] ?? null;
}

function getReportSummary(reportFile: HistoryFile | null) {
  if (!reportFile) {
    return {
      lastJob: "--",
      lastReport: "--",
      lastReportFile: "--",
      lastReportAt: "--",
    };
  }

  const data = reportFile.data;
  return {
    lastJob: getStringAtPath(data, ["payload", "jobId"], getStringAtPath(data, ["id"], reportFile.name)),
    lastReport: getStringAtPath(data, ["payload", "status"], "UNKNOWN"),
    lastReportFile: reportFile.relativePath,
    lastReportAt: getStringAtPath(data, ["createdAt"], reportFile.modifiedAt),
  };
}

function getHistorySignature(history: HistorySnapshot): string {
  const latest = getLatestReport(history);
  return [
    latest?.name ?? "none",
    latest?.modifiedAt ?? "none",
    history.reports.length,
    history.processed.length,
    history.failed.length,
    history.jobs.length,
  ].join("|");
}

function appendHistoryEvents(history: HistorySnapshot): void {
  const signature = getHistorySignature(history);
  if (signature === lastHistorySignature) return;
  lastHistorySignature = signature;

  const latest = getLatestReport(history);
  if (!latest) return;

  const data = latest.data;
  const jobId = getStringAtPath(data, ["payload", "jobId"], latest.name);
  const status = getStringAtPath(data, ["payload", "status"], "UNKNOWN");
  pushEvent("report", `${status}: ${jobId}`);
}

function getDriverStatuses(drivers: string[]) {
  return [
    { id: "browser", label: "Browser Agent", status: "online", detail: "Watching ChatGPT conversation" },
    { id: "chatgpt", label: "ChatGPT", status: "online", detail: "Conversation bridge connected" },
    { id: "powershell", label: "PowerShell", status: "online", detail: "Runtime adapter ready" },
    { id: "dashboard", label: "Dashboard", status: "online", detail: "Mission Control running" },
    { id: "filesystem", label: "Filesystem", status: drivers.includes("filesystem") ? "online" : "offline", detail: "Read/write files" },
    { id: "dehlero", label: "Dehlero", status: drivers.includes("dehlero") ? "waiting" : "offline", detail: "Registered; API waits for Dehlero app" },
    { id: "blender", label: "Blender", status: drivers.includes("blender") ? "waiting" : "offline", detail: drivers.includes("blender") ? "Registered; executable detection pending" : "Driver not registered" },
    { id: "youtube", label: "YouTube", status: "offline", detail: "Future driver" },
    { id: "codex", label: "Codex", status: "offline", detail: "Optional later" },
  ];
}

export async function startDashboardServer(options: DashboardServerOptions): Promise<DashboardServerHandle | null> {
  const port = options.port ?? Number(process.env.KEYNU_DASHBOARD_PORT ?? 4777);
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const missionManager = new MissionManager();
  const graphQueryService = options.graphQueryService ?? new GraphQueryService();
  const graphEventStore = options.graphEventStore ?? new GraphEventStore();
  const effectiveGraphQueryService = options.effectiveGraphQueryService ?? new EffectiveGraphQueryService();
  const operationalInsightsService = options.operationalInsightsService ?? new OperationalInsightsService(effectiveGraphQueryService);

  pushEvent("dashboard", "Dashboard server boot requested");

  const server = createServer(async (request, response) => {
    try {
      const path = getPath(request);
      const handledByDashboardApi = await handleDashboardApi(request, response);
      if (handledByDashboardApi) {
        return;
      }

      if (request.method !== "GET") {
        sendJson(response, 405, { ok: false, error: "Method not allowed" });
        return;
      }

      if (path === "/") {
        sendHtml(response, 200, renderDashboardHtml());
        return;
      }

      if (path === "/assets/graph3dClient.js") {
        const clientPath = join(process.cwd(), "dist", "app", "public", "graph3dClient.js");
        if (!existsSync(clientPath)) {
          sendJson(response, 404, { ok: false, error: "Graph 3D client bundle is missing" });
          return;
        }
        sendJavaScript(response, 200, readFileSync(clientPath, "utf8"));
        return;
      }

      if (path === "/health") {
        sendJson(response, 200, { ok: true, service: "keynu-dashboard", startedAt });
        return;
      }

      if (path === "/api/graph/runtime-intelligence") {
      try {
        const snapshot = new RuntimeGraphIntelligence().createSnapshot();
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        response.end(JSON.stringify(snapshot));
      } catch (error) {
        response.writeHead(500, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        response.end(
          JSON.stringify({
            error: "runtime_graph_intelligence_failed",
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
      return;
    }

    if (path === "/api/graph/operational-insights") {
        sendJson(response, 200, {
          ok: true,
          operationalInsights: operationalInsightsService.getSummary(),
        });
        return;
      }

      if (path === "/api/graph/effective/summary") {
        sendJson(response, 200, { ok: true, graph: effectiveGraphQueryService.getSummary() });
        return;
      }

      if (path === "/api/graph/effective/node") {
        const requestUrl = new URL(request.url ?? path, "http://127.0.0.1");
        const nodeId = requestUrl.searchParams.get("nodeId")?.trim();
        if (!nodeId) {
          sendJson(response, 400, { ok: false, error: "nodeId is required" });
          return;
        }
        const node = effectiveGraphQueryService.getNode(nodeId);
        sendJson(response, node ? 200 : 404, {
          ok: Boolean(node),
          node,
          error: node ? undefined : "Graph node not found",
        });
        return;
      }

      if (path === "/api/graph/effective/neighbors") {
        const requestUrl = new URL(request.url ?? path, "http://127.0.0.1");
        const nodeId = requestUrl.searchParams.get("nodeId")?.trim();
        if (!nodeId) {
          sendJson(response, 400, { ok: false, error: "nodeId is required" });
          return;
        }
        const result = effectiveGraphQueryService.queryNeighbors(
          nodeId,
          Number(requestUrl.searchParams.get("depth") ?? 1),
        );
        sendJson(response, result.node ? 200 : 404, {
          ok: Boolean(result.node),
          ...result,
          error: result.node ? undefined : "Graph node not found",
        });
        return;
      }

      if (path === "/api/graph/effective/impact") {
        const requestUrl = new URL(request.url ?? path, "http://127.0.0.1");
        const nodeId = requestUrl.searchParams.get("nodeId")?.trim();
        if (!nodeId) {
          sendJson(response, 400, { ok: false, error: "nodeId is required" });
          return;
        }
        const result = effectiveGraphQueryService.queryImpact(
          nodeId,
          Number(requestUrl.searchParams.get("depth") ?? 3),
        );
        sendJson(response, result.node ? 200 : 404, {
          ok: Boolean(result.node),
          ...result,
          error: result.node ? undefined : "Graph node not found",
        });
        return;
      }

      if (path === "/api/graph/effective/activity") {
        const requestUrl = new URL(request.url ?? path, "http://127.0.0.1");
        const items = effectiveGraphQueryService.queryRecentActivity(
          Number(requestUrl.searchParams.get("limit") ?? 50),
        );
        sendJson(response, 200, {
          ok: true,
          total: items.length,
          items,
        });
        return;
      }

      if (path === "/api/graph/effective/nodes") {
        const requestUrl = new URL(request.url ?? path, "http://127.0.0.1");
        const result = effectiveGraphQueryService.queryNodes({
          search: requestUrl.searchParams.get("search") ?? undefined,
          kind: requestUrl.searchParams.get("kind") ?? undefined,
          state: requestUrl.searchParams.get("state") ?? undefined,
          offset: Number(requestUrl.searchParams.get("offset") ?? 0),
          limit: Number(requestUrl.searchParams.get("limit") ?? 100),
        });
        sendJson(response, 200, { ok: true, ...result });
        return;
      }

      if (path === "/api/graph/effective/edges") {
        const requestUrl = new URL(request.url ?? path, "http://127.0.0.1");
        const result = effectiveGraphQueryService.queryEdges({
          search: requestUrl.searchParams.get("search") ?? undefined,
          kind: requestUrl.searchParams.get("kind") ?? undefined,
          state: requestUrl.searchParams.get("state") ?? undefined,
          offset: Number(requestUrl.searchParams.get("offset") ?? 0),
          limit: Number(requestUrl.searchParams.get("limit") ?? 100),
        });
        sendJson(response, 200, { ok: true, ...result });
        return;
      }

      if (path === "/api/graph/events/summary") {
        sendJson(response, 200, { ok: true, events: graphEventStore.getSummary() });
        return;
      }

      if (path === "/api/graph/events") {
        const requestUrl = new URL(request.url ?? path, "http://127.0.0.1");
        const result = graphEventStore.query({
          jobId: requestUrl.searchParams.get("jobId") ?? undefined,
          missionId: requestUrl.searchParams.get("missionId") ?? undefined,
          workflowId: requestUrl.searchParams.get("workflowId") ?? undefined,
          taskId: requestUrl.searchParams.get("taskId") ?? undefined,
          type: requestUrl.searchParams.get("type") as any ?? undefined,
          nodeId: requestUrl.searchParams.get("nodeId") ?? undefined,
          edgeId: requestUrl.searchParams.get("edgeId") ?? undefined,
          offset: Number(requestUrl.searchParams.get("offset") ?? 0),
          limit: Number(requestUrl.searchParams.get("limit") ?? 100),
        });
        sendJson(response, 200, { ok: true, ...result });
        return;
      }

      if (path === "/api/graph/summary") {
        sendJson(response, 200, { ok: true, graph: graphQueryService.getSummary() });
        return;
      }

      if (path === "/api/graph/nodes") {
        const requestUrl = new URL(request.url ?? path, "http://127.0.0.1");
        const result = graphQueryService.queryNodes({
          nodeKind: requestUrl.searchParams.get("kind") ?? undefined,
          nodeState: requestUrl.searchParams.get("state") ?? undefined,
          search: requestUrl.searchParams.get("search") ?? undefined,
          offset: Number(requestUrl.searchParams.get("offset") ?? 0),
          limit: Number(requestUrl.searchParams.get("limit") ?? 100),
        });
        sendJson(response, 200, { ok: true, ...result });
        return;
      }

      if (path === "/api/graph/edges") {
        const requestUrl = new URL(request.url ?? path, "http://127.0.0.1");
        const result = graphQueryService.queryEdges({
          edgeKind: requestUrl.searchParams.get("kind") ?? undefined,
          edgeState: requestUrl.searchParams.get("state") ?? undefined,
          search: requestUrl.searchParams.get("search") ?? undefined,
          offset: Number(requestUrl.searchParams.get("offset") ?? 0),
          limit: Number(requestUrl.searchParams.get("limit") ?? 100),
        });
        sendJson(response, 200, { ok: true, ...result });
        return;
      }

      if (path === "/api/history") {
        const history = getHistorySnapshot();
        sendJson(response, 200, { ok: true, ...history });
        return;
      }

      if (path === "/api/status") {
        refreshCount += 1;
        const history = getHistorySnapshot();
        appendHistoryEvents(history);

        const processResult = await handleProcessManagerPayload({ cwd: process.cwd(), processAction: "list" });
        if (refreshCount === 1 || refreshCount % 10 === 0) {
          pushEvent("refresh", `Dashboard status refresh #${refreshCount}`);
        }

        const drivers = options.driverManager.list();
        const processes = processResult?.processes ?? [];
        const driverStatuses = getDriverStatuses(drivers);
        const reportSummary = getReportSummary(getLatestReport(history));
        const session = readDashboardSession();
        const dashboardRuntime = getDashboardRuntime(session);
        const dashboardBrowser = getDashboardBrowser(session);
        const mission = missionManager.getStatus();

        sendJson(response, 200, {
          ok: true,
          service: "keynu-dashboard",
          startedAt,
          uptimeSeconds: getUptimeSeconds(startedAtMs),
          runtime: {
            ...reportSummary,
            ...dashboardRuntime,
          },
          browser: dashboardBrowser,
          mission,
          session,
          drivers,
          driverStatuses,
          capabilities: options.capabilities,
          processes,
          history: {
            reportCount: history.reports.length,
            processedCount: history.processed.length,
            failedCount: history.failed.length,
            jobCount: history.jobs.length,
            latestReports: history.reports.slice(0, 8).map((file) => ({
              name: file.name,
              relativePath: file.relativePath,
              modifiedAt: file.modifiedAt,
              jobId: getStringAtPath(file.data, ["payload", "jobId"], file.name),
              status: getStringAtPath(file.data, ["payload", "status"], "UNKNOWN"),
            })),
          },
          metrics: {
            refreshCount,
            driverCount: driverStatuses.length,
            registeredDriverCount: drivers.length,
            capabilityCount: options.capabilities.length,
            processCount: processes.length,
            reportCount: history.reports.length,
            failedCount: history.failed.length,
            memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
          },
          events: recentEvents,
        });
        return;
      }

      sendJson(response, 404, { ok: false, error: "Not found" });
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
  } catch (error) {
    if (isPortInUseError(error)) {
      console.log(`Dashboard already running on http://127.0.0.1:${port}`);
      console.log("Keynu will continue without starting a second dashboard server.");
      return null;
    }
    throw error;
  }

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error("Dashboard server address is unavailable.");
  }

  const actualPort = address.port;
  const host = "127.0.0.1";
  const url = `http://${host}:${actualPort}`;

  pushEvent("dashboard", `Dashboard listening on port ${actualPort}`);
  console.log(`Dashboard UI: ${url}`);
  console.log(`Dashboard API: ${url}/api/status`);

  return {
    server,
    host,
    port: actualPort,
    url,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}



