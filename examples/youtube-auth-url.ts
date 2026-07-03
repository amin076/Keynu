import { YouTubeDriver } from "../src/drivers/youtube/index.js";
import { youtubeOptionsFromEnv } from "../src/drivers/youtube/env.js";

const driver = new YouTubeDriver(youtubeOptionsFromEnv());
console.log(driver.getAuthorizationUrl());
