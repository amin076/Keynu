import { readFileSync } from "node:fs";
import { Command } from "commander";
import { handlePowerShellKapJob } from "./powershell-runtime-adapter.js";

const program = new Command();

program
  .name("powershell-runtime-adapter")
  .description("Run a PowerShell KAP job through the Keynu runtime adapter")
  .command("run")
  .argument("<jobFile>", "Path to KAP job JSON")
  .action(async (jobFile: string) => {
    const job = JSON.parse(readFileSync(jobFile, "utf8"));
    const report = await handlePowerShellKapJob(job);
    console.log(JSON.stringify(report, null, 2));

    if (report.payload.status !== "COMPLETED") {
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
