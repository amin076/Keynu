#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { collectPowerShellProjectContext } from "./powershell-context.js";

const program = new Command();

program
  .name("keynu-powershell-context")
  .command("collect")
  .argument("<jobPath>")
  .action(async (jobPath: string) => {
    const job = JSON.parse(readFileSync(jobPath, "utf8"));
    const payload = job.payload ?? job;
    const report = await collectPowerShellProjectContext(payload);
    console.log(payload.outputPath ? `Context report written: ${payload.outputPath}` : JSON.stringify(report, null, 2));
  });

program.parse(process.argv);
