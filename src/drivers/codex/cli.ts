#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { CodexDriver } from "./CodexDriver.js";

function usage() {
  console.error(`Usage:
  node dist/drivers/codex/cli.js prepare <job.json> [--output-root .keynu/codex]
  node dist/drivers/codex/cli.js complete <job-id> <codex-result.md> [report.json]`);
}

async function main() {
  const [command, arg2, arg3, arg4, arg5] = process.argv.slice(2);
  const driver = new CodexDriver();

  if (!command) {
    usage();
    process.exit(2);
  }

  if (command === "prepare") {
    if (!arg2) {
      usage();
      process.exit(2);
    }

    const outputRoot = parseOutputRoot(arg3, arg4);
    const result = await driver.prepareJobFile(arg2, { outputRoot });

    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "complete") {
    if (!arg2 || !arg3) {
      usage();
      process.exit(2);
    }

    const resultText = await readFile(arg3, "utf8");
    const report = driver.createCompletedReport(arg2, resultText);
    const text = `${JSON.stringify(report, null, 2)}\n`;

    if (arg4) {
      await writeFile(arg4, text, "utf8");
    }

    console.log(text.trimEnd());
    return;
  }

  if (arg5) {
    usage();
    process.exit(2);
  }

  usage();
  process.exit(2);
}

function parseOutputRoot(flag?: string, value?: string): string | undefined {
  if (!flag) {
    return undefined;
  }

  if (flag !== "--output-root" || !value) {
    usage();
    process.exit(2);
  }

  return value;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
