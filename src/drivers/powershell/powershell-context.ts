import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { collectGitSnapshot, listPowerShellFiles, runPowerShellCommand } from "./powershell-runner.js";

export type PowerShellContextOptions = {
  cwd: string;
  outputPath?: string;
  maxFiles?: number;
  includeBuild?: boolean;
};

export async function collectPowerShellProjectContext(options: PowerShellContextOptions) {
  const cwd = options.cwd;
  const packageJsonPath = join(cwd, "package.json");

  const report = {
    createdAt: new Date().toISOString(),
    cwd,
    files: listPowerShellFiles(cwd, options.maxFiles ?? 200),
    packageJson: existsSync(packageJsonPath) ? readFileSync(packageJsonPath, "utf8") : null,
    git: await collectGitSnapshot(cwd),
    build: options.includeBuild ? await runPowerShellCommand(cwd, { command: "npm", args: ["run", "build"] }) : null,
  };

  if (options.outputPath) {
    mkdirSync(dirname(options.outputPath), { recursive: true });
    writeFileSync(options.outputPath, JSON.stringify(report, null, 2), "utf8");
  }

  return report;
}
