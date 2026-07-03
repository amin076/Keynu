import { readFile, writeFile } from "node:fs/promises";
import { YouTubeDriver } from "./youtubeDriver.js";
import { readYouTubeConfig, youtubeOptionsFromConfig } from "./configManager.js";
import type { YouTubeUploadInput } from "./types.js";
import type { YouTubeUploadJob, YouTubeUploadJobReport } from "./jobTypes.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeUploadInput(job: YouTubeUploadJob): YouTubeUploadInput {
  const p = job.payload;
  return {
    videoPath: p.videoPath,
    title: p.title,
    description: p.description ?? "",
    tags: p.tags ?? [],
    categoryId: p.categoryId,
    privacyStatus: p.privacyStatus ?? p.privacy,
    madeForKids: p.madeForKids ?? false,
    notifySubscribers: p.notifySubscribers ?? false,
    thumbnailPath: p.thumbnailPath,
    playlistId: p.playlistId,
    defaultLanguage: p.defaultLanguage,
    defaultAudioLanguage: p.defaultAudioLanguage,
  };
}

export async function runYouTubeUploadJob(job: YouTubeUploadJob): Promise<YouTubeUploadJobReport> {
  const createdAt = nowIso();

  try {
    const config = await readYouTubeConfig(job.payload.configPath);
    if (!config.refreshToken) {
      throw new Error("Missing refreshToken in config/youtube.json. Run: node dist/drivers/youtube/cli.js auth-login");
    }

    const driver = new YouTubeDriver(youtubeOptionsFromConfig(config));
    const result = await driver.upload(normalizeUploadInput(job));

    return {
      protocol: "KAP",
      version: "1.0",
      type: "REPORT",
      id: `report-${job.id}`,
      createdAt,
      payload: {
        jobId: job.id,
        status: "COMPLETED",
        result: {
          videoId: result.videoId,
          videoUrl: result.videoUrl,
          privacyStatus: result.privacyStatus,
          playlistItemId: result.playlistItemId,
          thumbnailSet: result.thumbnailSet,
        },
      },
    };
  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    return {
      protocol: "KAP",
      version: "1.0",
      type: "REPORT",
      id: `report-${job.id}`,
      createdAt,
      payload: {
        jobId: job.id,
        status: "FAILED",
        error: {
          name: e.name,
          message: e.message,
        },
      },
    };
  }
}

export async function runYouTubeUploadJobFile(jobPath: string, reportPath?: string): Promise<YouTubeUploadJobReport> {
  const raw = await readFile(jobPath, "utf8");
  const job = JSON.parse(raw) as YouTubeUploadJob;
  const report = await runYouTubeUploadJob(job);

  if (reportPath) {
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  }

  return report;
}
