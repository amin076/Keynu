#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { runPowerShellRuntimeJob } from "./powershell-runtime.js";

const program = new Command();

program
  .name("keynu-powershell-runtime")
  .command("run")
  .argument("<jobPath>")
  .action(async (jobPath: string) => {
    const job = JSON.parse(readFileSync(jobPath, "utf8"));
    const report = await runPowerShellRuntimeJob(job);
    console.log(JSON.stringify(report, null, 2));
  });

program.parse(process.argv);
