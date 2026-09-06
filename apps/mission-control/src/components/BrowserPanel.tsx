import { useEffect, useMemo, useState } from "react";
import StatusCard, { type StatusTone } from "./StatusCard.js";
import type { RuntimeSnapshot } from "../state/RuntimeStore.js";

export type BrowserPanelProps = {
  runtime: RuntimeSnapshot;
};

type BrowserPage = {
  id: string;
  title: string;
  url: string;
  type: string;
};

type BrowserStatus = {
  browserRunning: boolean;
  agentRunning: boolean;
  cdpUrl: string;
  remoteDebuggingPort: number;
  profilePath: string;
  selectedPageId: string | null;
  selectedPageUrl: string | null;
  selectedPageTitle: string | null;
  agentPid: number | null;
};

const EMPTY_STATUS: BrowserStatus = {
  browserRunning: false,
  agentRunning: false,
  cdpUrl: "http://127.0.0.1:9222",
  remoteDebuggingPort: 9222,
  profilePath: "C:\\keynu-chrome",
  selectedPageId: null,
  selectedPageUrl: null,
  selectedPageTitle: null,
  agentPid: null,
};

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json() as { ok?: boolean; error?: string } & T;
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `Request failed with HTTP ${response.status}.`);
  }
  return body;
}

export default function BrowserPanel({ runtime }: BrowserPanelProps) {
  const [status, setStatus] = useState<BrowserStatus>(EMPTY_STATUS);
  const [pages, setPages] = useState<BrowserPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = status.agentRunning;
  const tone: StatusTone = connected ? "success" : status.browserRunning ? "warning" : "neutral";
  const value = connected
    ? "Connected"
    : status.browserRunning
      ? "Browser ready"
      : runtime.browser;

  const chatPages = useMemo(
    () => pages.filter((page) => /chatgpt\.com/i.test(page.url)),
    [pages],
  );
  const selectablePages = chatPages.length > 0 ? chatPages : pages;
  const selectedPage = selectablePages.find((page) => page.id === selectedPageId) ?? null;

  async function refreshStatus(): Promise<void> {
    const next = await requestJson<BrowserStatus>("/api/browser/status");
    setStatus(next);
    if (next.selectedPageId) setSelectedPageId(next.selectedPageId);
  }

  async function refreshPages(): Promise<void> {
    const result = await requestJson<{ pages: BrowserPage[] }>("/api/browser/pages");
    setPages(result.pages);

    const chatPagesNow = result.pages.filter((page) => /chatgpt\.com/i.test(page.url));
    const selectableNow = chatPagesNow.length > 0 ? chatPagesNow : result.pages;
    const currentStillExists = selectableNow.some((page) => page.id === selectedPageId);

    if (!currentStillExists) {
      setSelectedPageId(selectableNow[0]?.id ?? "");
    }
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void run(async () => {
      await refreshStatus();
      try {
        await refreshPages();
      } catch {
        // Browser may not be running yet; the Start Browser action will populate pages.
      }
    });
  }, []);

  return (
    <StatusCard
      title="Browser Agent"
      value={value}
      description="Start Keynu's managed Chrome, choose the ChatGPT tab, then attach BrowserAgent from this dashboard."
      tone={tone}
      footer={
        <div style={{ display: "grid", gap: "0.65rem", width: "100%" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(async () => {
                await requestJson<BrowserStatus>("/api/browser/start", { method: "POST" });
                await refreshStatus();
                await refreshPages();
              })}
            >
              {status.browserRunning ? "Browser running" : "Start Browser"}
            </button>
            <button
              type="button"
              disabled={busy || !status.browserRunning}
              onClick={() => void run(refreshPages)}
            >
              Refresh pages
            </button>
          </div>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Select ChatGPT page</span>
            <select
              value={selectedPageId}
              disabled={busy || selectablePages.length === 0}
              onChange={(event) => setSelectedPageId(event.target.value)}
              style={{ width: "100%" }}
            >
              {selectablePages.length === 0 ? (
                <option value="">No browser pages found</option>
              ) : selectablePages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title} — {page.url}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busy || !selectedPage || !status.browserRunning}
              onClick={() => void run(async () => {
                if (!selectedPage) throw new Error("Choose a browser page first.");
                await requestJson<BrowserStatus>("/api/browser/connect", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ id: selectedPage.id, url: selectedPage.url }),
                });
                await refreshStatus();
              })}
            >
              Connect selected page
            </button>
            <button
              type="button"
              disabled={busy || !status.agentRunning}
              onClick={() => void run(async () => {
                await requestJson<BrowserStatus>("/api/browser/disconnect", { method: "POST" });
                await refreshStatus();
              })}
            >
              Disconnect
            </button>
          </div>

          <small>
            Chrome: {status.browserRunning ? "running" : "stopped"} · Agent: {status.agentRunning ? "connected" : "disconnected"} · CDP: {status.remoteDebuggingPort}
          </small>
          {status.selectedPageTitle ? <small>Selected: {status.selectedPageTitle}</small> : null}
          {error ? <small role="alert">{error}</small> : null}
        </div>
      }
    />
  );
}
