import type { IncomingMessage, ServerResponse } from "node:http";

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body, null, 2));
}

export async function handleDashboardApi(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<boolean> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

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
