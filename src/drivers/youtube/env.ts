import type { YouTubeDriverOptions } from "./types.js";

export function youtubeOptionsFromEnv(): YouTubeDriverOptions {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || "http://localhost:7777/oauth2callback";
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    throw new Error("Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET");
  }

  return {
    oauth: { clientId, clientSecret, redirectUri, refreshToken },
    defaultCategoryId: process.env.YOUTUBE_DEFAULT_CATEGORY_ID || "28",
    defaultPrivacyStatus: (process.env.YOUTUBE_DEFAULT_PRIVACY as any) || "private",
    defaultMadeForKids: process.env.YOUTUBE_MADE_FOR_KIDS === "true",
  };
}
