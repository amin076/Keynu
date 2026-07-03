import fs from "node:fs";
import path from "node:path";
import type { youtube_v3 } from "googleapis";
import { YouTubeDriverError, normalizeError } from "./errors.js";

export async function setThumbnail(
  youtube: youtube_v3.Youtube,
  videoId: string,
  thumbnailPath?: string,
): Promise<boolean> {
  if (!thumbnailPath) return false;
  if (!fs.existsSync(thumbnailPath)) {
    throw new YouTubeDriverError(`Thumbnail file not found: ${thumbnailPath}`);
  }

  try {
    await youtube.thumbnails.set({
      videoId,
      media: {
        mimeType: guessImageMimeType(thumbnailPath),
        body: fs.createReadStream(thumbnailPath),
      },
    });
    return true;
  } catch (error) {
    throw new YouTubeDriverError(`YouTube thumbnail failed: ${normalizeError(error)}`, error);
  }
}

function guessImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
