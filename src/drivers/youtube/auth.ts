import { google, youtube_v3 } from "googleapis";
import type { YouTubeOAuthConfig } from "./types.js";

export const YOUTUBE_UPLOAD_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

export function createOAuthClient(config: YouTubeOAuthConfig) {
  const client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );

  if (config.refreshToken) {
    client.setCredentials({ refresh_token: config.refreshToken });
  }

  return client;
}

export function getAuthUrl(config: YouTubeOAuthConfig): string {
  const client = createOAuthClient(config);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    response_type: "code",
    scope: YOUTUBE_UPLOAD_SCOPES,
  });
}

export async function exchangeCodeForTokens(config: YouTubeOAuthConfig, code: string) {
  const client = createOAuthClient(config);
  const { tokens } = await client.getToken(code);
  return tokens;
}

export function createYouTubeClient(auth: ReturnType<typeof createOAuthClient>): youtube_v3.Youtube {
  return google.youtube({ version: "v3", auth });
}
