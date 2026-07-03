import fs from "node:fs";
import path from "node:path";
import type { youtube_v3 } from "googleapis";
import type { YouTubeUploadInput, YouTubePrivacyStatus } from "./types.js";
import { buildMetadata } from "./metadata.js";
import { YouTubeDriverError, normalizeError } from "./errors.js";

export async function uploadVideo(
  youtube: youtube_v3.Youtube,
  input: YouTubeUploadInput,
  fallbackCategoryId?: string,
): Promise<{ videoId: string; privacyStatus: YouTubePrivacyStatus }> {
  if (!fs.existsSync(input.videoPath)) {
    throw new YouTubeDriverError(`Video file not found: ${input.videoPath}`);
  }

  const metadata = buildMetadata(input, fallbackCategoryId);
  const privacyStatus = input.privacyStatus ?? "private";

  try {
    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      notifySubscribers: input.notifySubscribers ?? false,
      requestBody: {
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          categoryId: metadata.categoryId,
          defaultLanguage: input.defaultLanguage,
          defaultAudioLanguage: input.defaultAudioLanguage,
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: metadata.madeForKids,
        },
      },
      media: {
        mimeType: guessVideoMimeType(input.videoPath),
        body: fs.createReadStream(input.videoPath),
      },
    });

    const videoId = response.data.id;
    if (!videoId) throw new YouTubeDriverError("YouTube upload succeeded but no videoId returned.");
    return { videoId, privacyStatus };
  } catch (error) {
    throw new YouTubeDriverError(`YouTube upload failed: ${normalizeError(error)}`, error);
  }
}

function guessVideoMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".webm") return "video/webm";
  return "video/*";
}
