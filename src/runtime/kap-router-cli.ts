import { readFileSync } from "node:fs";
import { Command } from "commander";
import { routeKapJob } from "./kap-job-router.js";

const program = new Command();

program
  .name("kap-router")
  .description("Route a KAP JOB to the correct Keynu runtime handler")
  .command("run")
  .argument("<jobFile>", "Path to KAP job JSON")
  .action(async (jobFile: string) => {
    const raw = readFileSync(jobFile, "utf8");
    const job = JSON.parse(raw);
    const report = await routeKapJob(job);
    console.log(JSON.stringify(report, null, 2));

    if ((report as any).payload?.status !== "COMPLETED") {
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
