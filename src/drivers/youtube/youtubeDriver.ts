import { createOAuthClient, createYouTubeClient, exchangeCodeForTokens, getAuthUrl } from "./auth.js";
import { uploadVideo } from "./upload.js";
import { setThumbnail } from "./thumbnail.js";
import { addVideoToPlaylist } from "./playlist.js";
import type { YouTubeDriverOptions, YouTubeUploadInput, YouTubeUploadResult } from "./types.js";

export class YouTubeDriver {
  private auth: ReturnType<typeof createOAuthClient>;
  private youtube: ReturnType<typeof createYouTubeClient>;

  constructor(private options: YouTubeDriverOptions) {
    this.auth = createOAuthClient(options.oauth);
    this.youtube = createYouTubeClient(this.auth);
  }

  getAuthorizationUrl(): string {
    return getAuthUrl(this.options.oauth);
  }

  async exchangeCode(code: string) {
    return exchangeCodeForTokens(this.options.oauth, code);
  }

  async upload(input: YouTubeUploadInput): Promise<YouTubeUploadResult> {
    const merged: YouTubeUploadInput = {
      ...input,
      categoryId: input.categoryId ?? this.options.defaultCategoryId,
      privacyStatus: input.privacyStatus ?? this.options.defaultPrivacyStatus ?? "private",
      madeForKids: input.madeForKids ?? this.options.defaultMadeForKids ?? false,
    };

    const uploaded = await uploadVideo(this.youtube, merged, this.options.defaultCategoryId);
    const thumbnailSet = await setThumbnail(this.youtube, uploaded.videoId, merged.thumbnailPath);
    const playlistItemId = await addVideoToPlaylist(this.youtube, uploaded.videoId, merged.playlistId);

    return {
      videoId: uploaded.videoId,
      videoUrl: `https://www.youtube.com/watch?v=${uploaded.videoId}`,
      privacyStatus: uploaded.privacyStatus,
      playlistItemId,
      thumbnailSet,
    };
  }
}
