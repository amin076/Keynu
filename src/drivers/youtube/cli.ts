#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { runYouTubeAuthLogin } from "./authLogin.js";
import { runYouTubeUploadJobFile } from "./jobRunner.js";

function usage() {
  console.error(`Usage:
  node dist/drivers/youtube/cli.js auth-login [config/youtube.json]
  node dist/drivers/youtube/cli.js upload <job.json> [report.json]
  node dist/drivers/youtube/cli.js <job.json> [report.json]`);
}

async function main() {
  const [commandOrJob, arg2, arg3] = process.argv.slice(2);

  if (!commandOrJob) {
    usage();
    process.exit(2);
  }

  if (commandOrJob === "auth-login") {
    const result = await runYouTubeAuthLogin({ configPath: arg2 });
    console.log(JSON.stringify({ status: "COMPLETED", result }, null, 2));
    return;
  }

  const jobPath = commandOrJob === "upload" ? arg2 : commandOrJob;
  const reportPath = commandOrJob === "upload" ? arg3 : arg2;

  if (!jobPath) {
    usage();
    process.exit(2);
  }

  const report = await runYouTubeUploadJobFile(jobPath);
  const text = JSON.stringify(report, null, 2);

  if (reportPath) {
    await writeFile(reportPath, text + "\n", "utf8");
  }

  console.log(text);
  process.exit(report.payload.status === "COMPLETED" ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
