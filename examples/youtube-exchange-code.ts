import { YouTubeDriver } from "../src/drivers/youtube/index.js";
import { youtubeOptionsFromEnv } from "../src/drivers/youtube/env.js";

async function main() {
  const code = process.argv[2];
  if (!code) throw new Error("Usage: tsx examples/youtube-exchange-code.ts <oauth-code>");
  const driver = new YouTubeDriver(youtubeOptionsFromEnv());
  const tokens = await driver.exchangeCode(code);
  console.log(JSON.stringify(tokens, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
