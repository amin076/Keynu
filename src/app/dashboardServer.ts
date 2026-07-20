import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { execFileSync } from "node:child_process";
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

export function readJsonFileSafe(fullPath: string): unknown {
  try {
    return JSON.parse(readFileSync(fullPath, "utf8").replace(/^\uFEFF/, ""));
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
      const handledByDashboardApi = await handleDashboardApi(request, response, {
        getDrivers: () => options.driverManager?.getDriverSummaries() ?? [],
        getProcesses: async () => {
          const result = await handleProcessManagerPayload({ processAction: "list", cwd: process.cwd() });
          const payload = result as unknown as Record<string, unknown>;
          const raw = Array.isArray(payload.processes)
            ? payload.processes
            : Array.isArray(payload.items)
              ? payload.items
              : Array.isArray(result)
                ? result
                : [];
          return raw
            .map((entry) => {
              const process = entry as Record<string, unknown>;
              const pid = Number(process.pid ?? process.processId ?? process.ProcessId);
              if (!Number.isFinite(pid)) return null;
              const parentPid = Number(process.parentPid ?? process.parentProcessId ?? process.ParentProcessId);
              return {
                pid,
                parentPid: Number.isFinite(parentPid) ? parentPid : null,
                name: String(process.name ?? process.processName ?? process.Name ?? "Unknown process"),
                commandLine: String(process.commandLine ?? process.CommandLine ?? ""),
                status: String(process.status ?? process.Status ?? "Running"),
              };
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
            .filter((entry) => {
              const searchable = (entry.name + " " + entry.commandLine).toLowerCase();
              return searchable.includes("keynu") || searchable.includes("browseragent") || searchable.includes("runbrowseragent") || searchable.includes("mission-control") || searchable.includes("dist/index.js");
            });
        },
        getGitSummary: () => {
          const runGit = (args: string[]) => execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8" }).trim();
          const branch = runGit(["branch", "--show-current"]);
          const lines = runGit(["status", "--short"]).split(/\r?\n/).filter(Boolean);
          const files = lines.map((line) => ({ indexStatus: line[0] ?? " ", workTreeStatus: line[1] ?? " ", path: line.slice(3) }));
          const log = runGit(["log", "-10", "--pretty=format:%H%x09%h%x09%an%x09%aI%x09%s"]);
          const recentCommits = log ? log.split(/\r?\n/).map((line) => { const [hash, shortHash, author, authoredAt, ...subject] = line.split("\t"); return { hash: hash ?? "", shortHash: shortHash ?? "", author: author ?? "", authoredAt: authoredAt ?? "", subject: subject.join("\t") }; }) : [];
          return { branch: branch || "DETACHED", detached: !branch, clean: files.length === 0, stagedCount: files.filter((f) => f.indexStatus !== " " && f.indexStatus !== "?").length, modifiedCount: files.filter((f) => f.workTreeStatus !== " " && f.workTreeStatus !== "?").length, untrackedCount: files.filter((f) => f.indexStatus === "?" && f.workTreeStatus === "?").length, files, recentCommits };
        },
        getReports: () => {
          const roots = [
            join(process.cwd(), ".keynu"),
            join(process.cwd(), "data"),
            join(process.cwd(), "runtime"),
            join(process.cwd(), "reports"),
            join(process.cwd(), "logs"),
          ];
          const files: string[] = [];
          const visit = (directory: string, depth = 0) => {
            if (depth > 7 || !existsSync(directory) || files.length >= 500) return;
            for (const name of readdirSync(directory)) {
              if (files.length >= 500) break;
              const path = join(directory, name);
              let stats;
              try { stats = statSync(path); } catch { continue; }
              if (stats.isDirectory()) { visit(path, depth + 1); continue; }
              if (/\.json$/i.test(name) && /report|certificate|execution|evidence|mission|kap/i.test(path)) files.push(path);
            }
          };
          roots.forEach((root) => visit(root));
          const reports = [];
          for (const path of files) {
            try {
              const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
              const payload = (parsed.payload ?? {}) as Record<string, unknown>;
              const verification = (payload.verification ?? parsed.verification ?? {}) as Record<string, unknown>;
              const certificate = (payload.certificate ?? parsed.certificate ?? {}) as Record<string, unknown>;
              const id = String(parsed.id ?? payload.id ?? "");
              const type = String(parsed.type ?? payload.type ?? "");
              const looksLikeEvidence = /report|certificate|error/i.test(type) || /report|certificate|error/i.test(id) || Boolean(payload.jobId ?? parsed.jobId);
              if (!looksLikeEvidence) continue;
              reports.push({
                id: id || relative(process.cwd(), path),
                jobId: String(payload.jobId ?? parsed.jobId ?? ""),
                type: type || "REPORT",
                status: String(payload.status ?? parsed.status ?? "UNKNOWN"),
                createdAt: String(parsed.createdAt ?? payload.createdAt ?? ""),
                target: String(payload.target ?? parsed.target ?? ""),
                verificationStatus: verification.status ? String(verification.status) : null,
                certificateStatus: certificate.status ? String(certificate.status) : null,
                sourcePath: relative(process.cwd(), path).replace(/\\/g, "/"),
              });
            } catch { continue; }
          }
          return reports
            .sort((left, right) => Date.parse(right.createdAt || "0") - Date.parse(left.createdAt || "0"))
            .slice(0, 200);
        },
        getMemory: () => {
          const roots = [
            join(process.cwd(), ".keynu"),
            join(process.cwd(), "data"),
            join(process.cwd(), "runtime"),
            join(process.cwd(), "memory"),
            join(process.cwd(), "state"),
            join(process.cwd(), "missions"),
          ];
          const files: string[] = [];
          const visit = (directory: string, depth = 0) => {
            if (depth > 8 || !existsSync(directory) || files.length >= 500) return;
            for (const name of readdirSync(directory)) {
              if (files.length >= 500) break;
              const path = join(directory, name);
              let stats;
              try { stats = statSync(path); } catch { continue; }
              if (stats.isDirectory()) { visit(path, depth + 1); continue; }
              if (/\.json$/i.test(name) && /memory|state|checkpoint|continuation|resume|mission|knowledge|context|recovery/i.test(path)) files.push(path);
            }
          };
          roots.forEach((root) => visit(root));
          const summaries = [];
          for (const path of files) {
            try {
              const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
              const records = Array.isArray(parsed) ? parsed : [parsed];
              for (let index = 0; index < records.length && summaries.length < 250; index += 1) {
                const record = records[index];
                if (!record || typeof record !== "object") continue;
                const value = record as Record<string, unknown>;
                const payload = value.payload && typeof value.payload === "object" ? value.payload as Record<string, unknown> : {};
                const continuation = payload.continuation && typeof payload.continuation === "object" ? payload.continuation as Record<string, unknown> : {};
                const missionId = value.missionId ?? payload.missionId ?? continuation.missionId;
                const resumeToken = value.resumeToken ?? payload.resumeToken ?? continuation.resumeToken;
                const autonomousStep = Number(value.autonomousStep ?? payload.autonomousStep ?? continuation.autonomousStep);
                const updatedAt = value.updatedAt ?? value.createdAt ?? payload.updatedAt ?? payload.createdAt;
                const source = relative(process.cwd(), path).replace(/\\/g, "/");
                const searchable = (source + " " + Object.keys(value).join(" ")).toLowerCase();
                const category = searchable.includes("continuation") || searchable.includes("resume")
                  ? "continuation"
                  : searchable.includes("mission")
                    ? "mission-state"
                    : searchable.includes("knowledge") || searchable.includes("context")
                      ? "knowledge-memory"
                      : searchable.includes("checkpoint") || searchable.includes("recovery")
                        ? "checkpoint"
                        : "runtime-state";
                summaries.push({
                  id: String(value.id ?? value.missionId ?? source + "#" + index),
                  category,
                  missionId: missionId ? String(missionId) : null,
                  status: value.status || payload.status ? String(value.status ?? payload.status) : null,
                  updatedAt: updatedAt ? String(updatedAt) : null,
                  resumeTokenPresent: Boolean(resumeToken),
                  autonomousStep: Number.isFinite(autonomousStep) ? autonomousStep : null,
                  keyCount: Object.keys(value).length,
                  sourcePath: source,
                });
              }
            } catch { continue; }
          }
          return summaries
            .sort((left, right) => Date.parse(right.updatedAt || "0") - Date.parse(left.updatedAt || "0"))
            .slice(0, 250);
        },
      });
      if (handledByDashboardApi) {
        return;
      }

      if (request.method !== "GET") {
        sendJson(response, 405, { ok: false, error: "Method not allowed" });
        return;
      }

      if (path === "/") {
        sendHtml(response, 200, readFileSync(join(process.cwd(),'dist/app/public/index.html'),'utf8'));
        return;
      }

      if (path === "/mission-control.js") {
        const assetPath = join(process.cwd(), "dist", "app", "public", "mission-control.js");
        if (!existsSync(assetPath)) {
          sendJson(response, 404, { ok: false, error: "Mission Control JavaScript asset not found" });
          return;
        }
        response.writeHead(200, {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-cache"
        });
        response.end(readFileSync(assetPath));
        return;
      }

      if (path === "/mission-control.css") {
        const assetPath = join(process.cwd(), "dist", "app", "public", "mission-control.css");
        if (!existsSync(assetPath)) {
          sendJson(response, 404, { ok: false, error: "Mission Control CSS asset not found" });
          return;
        }
        response.writeHead(200, {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "no-cache"
        });
        response.end(readFileSync(assetPath));
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




