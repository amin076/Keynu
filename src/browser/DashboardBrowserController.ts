import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type DashboardBrowserPage = {
  id: string;
  title: string;
  url: string;
  type: string;
};

export type DashboardBrowserStatus = {
  browserRunning: boolean;
  agentRunning: boolean;
  cdpUrl: string;
  remoteDebuggingPort: number;
  profilePath: string;
  selectedPageUrl: string | null;
  selectedPageTitle: string | null;
  selectedPageId: string | null;
  agentPid: number | null;
};

type ChromeTarget = {
  id?: string;
  title?: string;
  url?: string;
  type?: string;
};

const DEFAULT_PORT = 9222;
const DEFAULT_PROFILE_PATH = "C:\\keynu-chrome";

export class DashboardBrowserController {
  private readonly port: number;
  private readonly profilePath: string;
  private browserProcess: ChildProcess | null = null;
  private agentProcess: ChildProcess | null = null;
  private selectedPageId: string | null = null;
  private selectedPageUrl: string | null = null;
  private selectedPageTitle: string | null = null;

  constructor(options: { port?: number; profilePath?: string } = {}) {
    this.port = options.port ?? Number(process.env.KEYNU_CDP_PORT ?? DEFAULT_PORT);
    this.profilePath = options.profilePath ?? process.env.KEYNU_BROWSER_PROFILE ?? DEFAULT_PROFILE_PATH;
  }

  get cdpUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async getStatus(): Promise<DashboardBrowserStatus> {
    return {
      browserRunning: await this.isBrowserRunning(),
      agentRunning: this.agentProcess !== null && this.agentProcess.exitCode === null && !this.agentProcess.killed,
      cdpUrl: this.cdpUrl,
      remoteDebuggingPort: this.port,
      profilePath: this.profilePath,
      selectedPageId: this.selectedPageId,
      selectedPageUrl: this.selectedPageUrl,
      selectedPageTitle: this.selectedPageTitle,
      agentPid: this.agentProcess?.pid ?? null,
    };
  }

  async startBrowser(): Promise<DashboardBrowserStatus> {
    if (!(await this.isBrowserRunning())) {
      const chrome = this.findChromeExecutable();
      if (!chrome) {
        throw new Error("Google Chrome executable was not found on this Windows machine.");
      }

      mkdirSync(this.profilePath, { recursive: true });

      this.browserProcess = spawn(
        chrome,
        [
          `--remote-debugging-port=${this.port}`,
          `--user-data-dir=${this.profilePath}`,
          "--no-first-run",
          "--no-default-browser-check",
          "https://chatgpt.com/",
        ],
        {
          detached: true,
          stdio: "ignore",
          windowsHide: false,
        },
      );
      this.browserProcess.unref();

      await this.waitForBrowser();
    }

    return this.getStatus();
  }

  async listPages(): Promise<DashboardBrowserPage[]> {
    if (!(await this.isBrowserRunning())) return [];

    const response = await fetch(`${this.cdpUrl}/json/list`);
    if (!response.ok) {
      throw new Error(`Chrome target list failed with HTTP ${response.status}.`);
    }

    const targets = (await response.json()) as ChromeTarget[];
    return targets
      .filter((target) => target.type === "page" && typeof target.url === "string")
      .map((target) => ({
        id: target.id ?? target.url ?? "unknown-page",
        title: target.title?.trim() || "Untitled page",
        url: target.url ?? "",
        type: target.type ?? "page",
      }))
      .filter((target) => Boolean(target.url));
  }

  async connectPage(selection: { id?: string; url?: string }): Promise<DashboardBrowserStatus> {
    const requestedId = selection.id?.trim() ?? "";
    const requestedUrl = selection.url?.trim() ?? "";
    if (!requestedId && !requestedUrl) {
      throw new Error("A browser page selection is required.");
    }

    await this.startBrowser();
    const pages = await this.listPages();
    const selected =
      (requestedId ? pages.find((page) => page.id === requestedId) : undefined) ??
      (requestedUrl ? pages.find((page) => page.url === requestedUrl) : undefined);

    if (!selected) {
      throw new Error(
        "The selected browser page is no longer open. Refresh the page list and choose the ChatGPT page again.",
      );
    }

    this.stopAgent();

    const runnerPath = join(process.cwd(), "dist", "browser", "runBrowserAgent.js");
    if (!existsSync(runnerPath)) {
      throw new Error("Browser Agent build output is missing. Run npm run build before connecting.");
    }

    this.selectedPageId = selected.id;
    this.selectedPageUrl = selected.url;
    this.selectedPageTitle = selected.title;

    this.agentProcess = spawn(process.execPath, [runnerPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        KEYNU_CONVERSATION_URL: selected.url,
        KEYNU_CDP_URL: this.cdpUrl,
      },
      stdio: "inherit",
      windowsHide: false,
    });

    this.agentProcess.once("exit", () => {
      this.agentProcess = null;
    });

    return this.getStatus();
  }

  async disconnectPage(): Promise<DashboardBrowserStatus> {
    this.stopAgent();
    this.selectedPageId = null;
    this.selectedPageUrl = null;
    this.selectedPageTitle = null;
    return this.getStatus();
  }

  private stopAgent(): void {
    if (this.agentProcess && this.agentProcess.exitCode === null && !this.agentProcess.killed) {
      this.agentProcess.kill();
    }
    this.agentProcess = null;
  }

  private async isBrowserRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.cdpUrl}/json/version`, { signal: AbortSignal.timeout(1200) });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async waitForBrowser(): Promise<void> {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (await this.isBrowserRunning()) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Chrome did not expose the CDP endpoint at ${this.cdpUrl} within 10 seconds.`);
  }

  private findChromeExecutable(): string | null {
    const candidates = [
      process.env.PROGRAMFILES ? join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe") : null,
      process.env["PROGRAMFILES(X86)"] ? join(process.env["PROGRAMFILES(X86)"]!, "Google", "Chrome", "Application", "chrome.exe") : null,
      process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe") : null,
    ].filter((candidate): candidate is string => Boolean(candidate));

    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  }
}

export const dashboardBrowserController = new DashboardBrowserController();
