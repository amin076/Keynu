export type YouTubePrivacyStatus = "private" | "unlisted" | "public";

export interface YouTubeOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
}

export interface YouTubeUploadInput {
  videoPath: string;
  title: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: YouTubePrivacyStatus;
  madeForKids?: boolean;
  notifySubscribers?: boolean;
  thumbnailPath?: string;
  playlistId?: string;
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
}

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
  privacyStatus: YouTubePrivacyStatus;
  playlistItemId?: string;
  thumbnailSet: boolean;
}

export interface YouTubeDriverOptions {
  oauth: YouTubeOAuthConfig;
  defaultCategoryId?: string;
  defaultPrivacyStatus?: YouTubePrivacyStatus;
  defaultMadeForKids?: boolean;
}

export interface YouTubeMetadataDraft {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  madeForKids: boolean;
}
