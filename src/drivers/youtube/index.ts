export { YouTubeDriver } from "./youtubeDriver.js";
export { getAuthUrl, exchangeCodeForTokens, YOUTUBE_UPLOAD_SCOPES } from "./auth.js";
export { buildMetadata, cleanTags, trimDescription, trimTitle } from "./metadata.js";
export type {
  YouTubeDriverOptions,
  YouTubeOAuthConfig,
  YouTubePrivacyStatus,
  YouTubeUploadInput,
  YouTubeUploadResult,
} from "./types.js";

export { readYouTubeConfig, writeYouTubeConfig, updateYouTubeConfig, youtubeOptionsFromConfig } from "./configManager.js";
export { runYouTubeAuthLogin } from "./authLogin.js";
