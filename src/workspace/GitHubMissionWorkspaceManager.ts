import { mkdir, realpath, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { executeCommand } from "../runtime/CommandExecutor.js";
import { GitHubMissionWorkspaceSpec, type GitHubMissionWorkspace } from "./GitHubMissionWorkspaceTypes.js";

function safeDirectoryName(repository: string, branch: string): string {
  return (repository + "--" + branch).replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 160);
}

export class GitHubMissionWorkspaceManager {
  async prepare(input: GitHubMissionWorkspaceSpec): Promise<GitHubMissionWorkspace> {
    const spec = GitHubMissionWorkspaceSpec.parse(input);
    const root = resolve(spec.workspaceRoot);
    await mkdir(root, { recursive: true });
    const projectRoot = join(root, safeDirectoryName(spec.repository, spec.missionBranch));
    const remoteUrl = `https://github.com/${spec.repository}.git`;

    try {
      await stat(projectRoot);
      throw new Error(`Mission workspace already exists: ${projectRoot}`);
    } catch (error) {
      if (error instanceof Error && !("code" in error && error.code === "ENOENT")) throw error;
    }

    const clone = await executeCommand({
      command: "git",
      args: ["clone", "--no-tags", "--single-branch", "--branch", spec.baseBranch, remoteUrl, projectRoot],
      timeoutMs: 300_000,
    }, root);
    if (!clone.ok) {
      await rm(projectRoot, { recursive: true, force: true });
      throw new Error(`Git clone failed: ${clone.error ?? clone.stderr.slice(-2000)}`);
    }

    const branch = await executeCommand({
      command: "git",
      args: ["switch", "-c", spec.missionBranch],
      timeoutMs: 60_000,
    }, projectRoot);
    if (!branch.ok) {
      await rm(projectRoot, { recursive: true, force: true });
      throw new Error(`Mission branch creation failed: ${branch.error ?? branch.stderr.slice(-2000)}`);
    }

    const commit = await executeCommand({
      command: "git",
      args: ["rev-parse", "HEAD"],
      timeoutMs: 30_000,
    }, projectRoot);
    if (!commit.ok || !commit.stdout.trim()) {
      await rm(projectRoot, { recursive: true, force: true });
      throw new Error("Could not resolve mission workspace base commit.");
    }

    return {
      repository: spec.repository,
      remoteUrl,
      baseBranch: spec.baseBranch,
      missionBranch: spec.missionBranch,
      projectRoot: await realpath(projectRoot),
      baseCommit: commit.stdout.trim(),
    };
  }

  async inspect(projectRootInput: string) {
    const projectRoot = await realpath(resolve(projectRootInput));
    const [branch, status, diff] = await Promise.all([
      executeCommand({ command: "git", args: ["branch", "--show-current"], timeoutMs: 30_000 }, projectRoot),
      executeCommand({ command: "git", args: ["status", "--short"], timeoutMs: 30_000 }, projectRoot),
      executeCommand({ command: "git", args: ["diff", "--stat"], timeoutMs: 30_000 }, projectRoot),
    ]);
    if (!branch.ok || !status.ok || !diff.ok) throw new Error("Could not inspect mission workspace.");
    return { projectRoot, branch: branch.stdout.trim(), status: status.stdout, diffStat: diff.stdout };
  }

  async remove(projectRootInput: string): Promise<void> {
    const projectRoot = await realpath(resolve(projectRootInput));
    await rm(projectRoot, { recursive: true, force: true });
    const parent = dirname(projectRoot);
    void parent;
  }
}
