import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { YouTubeDriverOptions, YouTubePrivacyStatus } from "./types.js";

export interface YouTubeConfigFile {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  redirectUri?: string;
  channelId?: string;
  defaultCategoryId?: string;
  defaultPrivacyStatus?: YouTubePrivacyStatus;
  defaultMadeForKids?: boolean;
}

export const DEFAULT_YOUTUBE_CONFIG_PATH = "config/youtube.json";
export const DEFAULT_LOCAL_REDIRECT_URI = "http://127.0.0.1:53682/oauth2callback";

export function resolveConfigPath(configPath = DEFAULT_YOUTUBE_CONFIG_PATH): string {
  return resolve(process.cwd(), configPath);
}

export async function readYouTubeConfig(configPath?: string): Promise<YouTubeConfigFile> {
  const fullPath = resolveConfigPath(configPath);
  if (!existsSync(fullPath)) {
    throw new Error(`YouTube config not found: ${fullPath}`);
  }

  const raw = await readFile(fullPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<YouTubeConfigFile>;

  if (!parsed.clientId || !parsed.clientSecret) {
    throw new Error(`YouTube config must include clientId and clientSecret: ${fullPath}`);
  }

  return {
    clientId: parsed.clientId,
    clientSecret: parsed.clientSecret,
    refreshToken: parsed.refreshToken,
    redirectUri: parsed.redirectUri ?? DEFAULT_LOCAL_REDIRECT_URI,
    channelId: parsed.channelId,
    defaultCategoryId: parsed.defaultCategoryId ?? "28",
    defaultPrivacyStatus: parsed.defaultPrivacyStatus ?? "private",
    defaultMadeForKids: parsed.defaultMadeForKids ?? false,
  };
}

export async function writeYouTubeConfig(config: YouTubeConfigFile, configPath?: string): Promise<string> {
  const fullPath = resolveConfigPath(configPath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  return fullPath;
}

export async function updateYouTubeConfig(
  patch: Partial<YouTubeConfigFile>,
  configPath?: string,
): Promise<YouTubeConfigFile> {
  const current = existsSync(resolveConfigPath(configPath))
    ? await readYouTubeConfig(configPath)
    : ({} as YouTubeConfigFile);

  const next: YouTubeConfigFile = {
    ...current,
    ...patch,
    redirectUri: patch.redirectUri ?? current.redirectUri ?? DEFAULT_LOCAL_REDIRECT_URI,
  };

  if (!next.clientId || !next.clientSecret) {
    throw new Error("Cannot save YouTube config without clientId and clientSecret.");
  }

  await writeYouTubeConfig(next, configPath);
  return next;
}

export function youtubeOptionsFromConfig(config: YouTubeConfigFile): YouTubeDriverOptions {
  return {
    oauth: {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri ?? DEFAULT_LOCAL_REDIRECT_URI,
      refreshToken: config.refreshToken,
    },
    defaultCategoryId: config.defaultCategoryId ?? "28",
    defaultPrivacyStatus: config.defaultPrivacyStatus ?? "private",
    defaultMadeForKids: config.defaultMadeForKids ?? false,
  };
}
