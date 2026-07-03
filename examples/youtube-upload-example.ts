import { YouTubeDriver } from "../src/drivers/youtube/index.js";
import { youtubeOptionsFromEnv } from "../src/drivers/youtube/env.js";

async function main() {
  const driver = new YouTubeDriver(youtubeOptionsFromEnv());

  const result = await driver.upload({
    videoPath: "C:/Physics/videos/test.mp4",
    thumbnailPath: "C:/Physics/videos/test-thumb.png",
    title: "Titan World Cup 3026 | Saturn Above the Stadium",
    description: "A cinematic science-fiction football short created with Keynu and Dehlero.",
    tags: ["Titan", "Saturn", "World Cup 3026", "space football", "science animation", "Dehlero", "Keynu AI"],
    playlistId: process.env.YOUTUBE_PLAYLIST_ID,
    madeForKids: false,
    privacyStatus: "public",
    notifySubscribers: false,
    defaultLanguage: "en",
    defaultAudioLanguage: "en",
  });

  console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
