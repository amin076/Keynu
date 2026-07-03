import type { YouTubePrivacyStatus } from "./types.js";

export interface YouTubeUploadJob {
  protocol: "KAP";
  version: "1.0";
  type: "COMMAND";
  id: string;
  createdAt?: string;
  payload: {
    action: "UPLOAD_YOUTUBE";
    configPath?: string;
    videoPath: string;
    title: string;
    description?: string;
    tags?: string[];
    categoryId?: string;
    privacy?: YouTubePrivacyStatus;
    privacyStatus?: YouTubePrivacyStatus;
    madeForKids?: boolean;
    notifySubscribers?: boolean;
    thumbnailPath?: string;
    playlistId?: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
  };
}

export interface YouTubeUploadJobReport {
  protocol: "KAP";
  version: "1.0";
  type: "REPORT";
  id: string;
  createdAt: string;
  payload: {
    jobId: string;
    status: "COMPLETED" | "FAILED";
    result?: {
      videoId: string;
      videoUrl: string;
      privacyStatus: YouTubePrivacyStatus;
      playlistItemId?: string;
      thumbnailSet?: boolean;
    };
    error?: {
      name: string;
      message: string;
    };
  };
}
