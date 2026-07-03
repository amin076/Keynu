import type { youtube_v3 } from "googleapis";
import { YouTubeDriverError, normalizeError } from "./errors.js";

export async function addVideoToPlaylist(
  youtube: youtube_v3.Youtube,
  videoId: string,
  playlistId?: string,
): Promise<string | undefined> {
  if (!playlistId) return undefined;

  try {
    const response = await youtube.playlistItems.insert({
      part: ["snippet"],
      requestBody: {
        snippet: {
          playlistId,
          resourceId: {
            kind: "youtube#video",
            videoId,
          },
        },
      },
    });

    return response.data.id ?? undefined;
  } catch (error) {
    throw new YouTubeDriverError(`Adding video to playlist failed: ${normalizeError(error)}`, error);
  }
}
