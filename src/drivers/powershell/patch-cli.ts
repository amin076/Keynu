import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Command } from "commander";
import { runPowerShellPatchJob } from "./powershell-patch.js";

const program = new Command();

function defaultReportPath(jobId: string) {
  return join(".keynu", "powershell", "reports", jobId + ".patch.report.json");
}

program
  .name("powershell-patch")
  .description("Run a Keynu PowerShell patch job and optionally write a report file")
  .command("run")
  .argument("<jobFile>", "Path to KAP patch job JSON")
  .option("-o, --output <path>", "Report output path")
  .action(async (jobFile: string, options: { output?: string }) => {
    const raw = readFileSync(jobFile, "utf8");
    const job = JSON.parse(raw);

    const report = await runPowerShellPatchJob(job);
    const outputPath = options.output ?? job.payload?.outputPath ?? defaultReportPath(job.id);

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");

    console.log(JSON.stringify(report, null, 2));
    console.error("Patch report written: " + outputPath);

    if (report.payload.status !== "COMPLETED") {
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
