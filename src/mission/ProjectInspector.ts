import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { MissionRepositoryState } from "./MissionTypes.js";

type PackageJsonData = {
  scripts?: Record<string, string>;
};

type ReportSummary = {
  jobId?: string;
  status?: string;
};

export class ProjectInspector {
  constructor(private readonly projectRoot = process.cwd()) {}

  inspect(): MissionRepositoryState {
    const report = this.readLatestReport();

    return {
      root: this.projectRoot,
      branch: this.readGitBranch(),
      changedFiles: this.readChangedFiles(),
      packageScripts: this.readPackageScripts(),
      drivers: this.readRegisteredDrivers(),
      capabilities: this.readRegisteredCapabilities(),
      lastJobId: report.jobId,
      lastReportStatus: report.status,
      graphSnapshotAvailable: this.hasGraphSnapshot(),
      inspectedAt: new Date().toISOString(),
    };
  }

  private runGit(args: string[]): string {
    try {
      return execFileSync("git", args, {
        cwd: this.projectRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return "";
    }
  }

  private readGitBranch(): string | undefined {
    return this.runGit(["branch", "--show-current"]) || undefined;
  }

  private readChangedFiles(): string[] {
    const output = this.runGit(["status", "--short"]);

    if (!output) {
      return [];
    }

    return output
      .split(/\r?\n/)
      .map((line) => line.slice(3).trim())
      .filter(Boolean);
  }

  private readPackageScripts(): Record<string, string> {
    const packagePath = join(this.projectRoot, "package.json");

    if (!existsSync(packagePath)) {
      return {};
    }

    try {
      const parsed = JSON.parse(
        readFileSync(packagePath, "utf8"),
      ) as PackageJsonData;

      return parsed.scripts ?? {};
    } catch {
      return {};
    }
  }

  private readRegisteredDrivers(): string[] {
    const sourcePath = join(
      this.projectRoot,
      "src",
      "core",
      "registerBuiltinDrivers.ts",
    );

    if (!existsSync(sourcePath)) {
      return [];
    }

    const source = readFileSync(sourcePath, "utf8");
    const driverIds = new Set<string>();

    for (const match of source.matchAll(/manager\.register\(new\s+([A-Za-z0-9_]+)\(/g)) {
      driverIds.add(match[1]);
    }

    return [...driverIds].sort();
  }

  private readRegisteredCapabilities(): string[] {
    const sourcePath = join(
      this.projectRoot,
      "src",
      "core",
      "registerBuiltinDrivers.ts",
    );

    if (!existsSync(sourcePath)) {
      return [];
    }

    const source = readFileSync(sourcePath, "utf8");
    const capabilityNames = new Set<string>();

    for (const match of source.matchAll(/name:\s*["']([^"']+)["']/g)) {
      capabilityNames.add(match[1]);
    }

    return [...capabilityNames].sort();
  }

  private hasGraphSnapshot(): boolean {
    const graphDirectory = join(this.projectRoot, ".keynu", "graph");

    if (!existsSync(graphDirectory)) {
      return false;
    }

    return readdirSync(graphDirectory).some((name) => name.endsWith(".json"));
  }

  private readLatestReport(): ReportSummary {
    const reportDirectories = [
      join(this.projectRoot, ".keynu", "powershell", "reports"),
      join(this.projectRoot, "processed"),
      join(this.projectRoot, "failed"),
    ];

    const candidates: Array<{ path: string; modifiedAt: number }> = [];

    for (const directory of reportDirectories) {
      if (!existsSync(directory)) {
        continue;
      }

      for (const name of readdirSync(directory)) {
        if (!name.endsWith(".json")) {
          continue;
        }

        const path = join(directory, name);
        candidates.push({
          path,
          modifiedAt: statSync(path).mtimeMs,
        });
      }
    }

    candidates.sort((a, b) => b.modifiedAt - a.modifiedAt);
    const latest = candidates[0];

    if (!latest) {
      return {};
    }

    try {
      const parsed = JSON.parse(readFileSync(latest.path, "utf8")) as {
        id?: string;
        payload?: {
          jobId?: string;
          status?: string;
        };
      };

      return {
        jobId: parsed.payload?.jobId ?? parsed.id,
        status: parsed.payload?.status,
      };
    } catch {
      return {};
    }
  }
}
