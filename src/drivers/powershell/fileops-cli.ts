#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import { runPowerShellFileOps } from "./powershell-fileops.js";

const program = new Command();

program
  .name("keynu-powershell-fileops")
  .command("run")
  .argument("<jobPath>")
  .option("-o, --output <outputPath>")
  .action(async (jobPath: string, options: { output?: string }) => {
    const job = JSON.parse(readFileSync(jobPath, "utf8"));
    const result = await runPowerShellFileOps(job.id ?? "manual-fileops-job", job.payload ?? job);

    if (options.output) {
      const out = resolve(options.output);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify(result, null, 2), "utf8");
      console.log(`FileOps report written: ${out}`);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  });

program.parse(process.argv);
