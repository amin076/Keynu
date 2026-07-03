import { createServer } from "node:http";
import { URL } from "node:url";
import { google } from "googleapis";
import { YOUTUBE_UPLOAD_SCOPES, exchangeCodeForTokens, getAuthUrl } from "./auth.js";
import {
  DEFAULT_LOCAL_REDIRECT_URI,
  readYouTubeConfig,
  updateYouTubeConfig,
  type YouTubeConfigFile,
} from "./configManager.js";

export interface AuthLoginOptions {
  configPath?: string;
  openBrowser?: boolean;
  timeoutMs?: number;
}

export interface AuthLoginResult {
  configPath: string;
  refreshTokenSaved: boolean;
  scopes: string[];
  channelId?: string;
}

function parseRedirectUri(redirectUri: string) {
  const url = new URL(redirectUri);
  return {
    hostname: url.hostname,
    port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    pathname: url.pathname,
  };
}

async function openUrlInBrowser(url: string) {
  const { spawn } = await import("node:child_process");
  const platform = process.platform;
  const command = platform === "win32" ? "cmd" : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

async function getChannelId(config: YouTubeConfigFile): Promise<string | undefined> {
  try {
    const auth = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    auth.setCredentials({ refresh_token: config.refreshToken });
    const youtube = google.youtube({ version: "v3", auth });
    const response = await youtube.channels.list({ part: ["id"], mine: true });
    return response.data.items?.[0]?.id ?? undefined;
  } catch {
    return undefined;
  }
}

export async function runYouTubeAuthLogin(options: AuthLoginOptions = {}): Promise<AuthLoginResult> {
  const config = await readYouTubeConfig(options.configPath);
  const redirectUri = config.redirectUri ?? DEFAULT_LOCAL_REDIRECT_URI;
  const parsed = parseRedirectUri(redirectUri);
  const timeoutMs = options.timeoutMs ?? 180_000;

  const authUrl = getAuthUrl({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri,
  });

  const code = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error("OAuth login timed out."));
    }, timeoutMs);

    const server = createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url ?? "/", redirectUri);
        if (requestUrl.pathname !== parsed.pathname) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }

        const error = requestUrl.searchParams.get("error");
        if (error) {
          res.statusCode = 400;
          res.end(`OAuth failed: ${error}`);
          clearTimeout(timer);
          server.close();
          reject(new Error(`OAuth failed: ${error}`));
          return;
        }

        const receivedCode = requestUrl.searchParams.get("code");
        if (!receivedCode) {
          res.statusCode = 400;
          res.end("Missing code");
          return;
        }

        res.statusCode = 200;
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.end("<h1>Keynu YouTube login completed</h1><p>You can close this tab.</p>");
        clearTimeout(timer);
        server.close();
        resolve(receivedCode);
      } catch (error) {
        clearTimeout(timer);
        server.close();
        reject(error);
      }
    });

    server.listen(parsed.port, parsed.hostname, async () => {
      console.log("Open this URL to connect Keynu to YouTube:");
      console.log(authUrl);
      if (options.openBrowser !== false) {
        await openUrlInBrowser(authUrl).catch(() => undefined);
      }
    });
  });

  const tokens = await exchangeCodeForTokens(
    {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri,
    },
    code,
  );

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Remove this app from your Google Account permissions, then run auth-login again.",
    );
  }

  const updated = await updateYouTubeConfig(
    {
      ...config,
      redirectUri,
      refreshToken: tokens.refresh_token,
    },
    options.configPath,
  );

  const channelId = await getChannelId(updated);
  if (channelId) {
    await updateYouTubeConfig({ ...updated, channelId }, options.configPath);
  }

  return {
    configPath: options.configPath ?? "config/youtube.json",
    refreshTokenSaved: true,
    scopes: YOUTUBE_UPLOAD_SCOPES,
    channelId,
  };
}
