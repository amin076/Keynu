import { GitHubMissionWorkspaceManager } from "./GitHubMissionWorkspaceManager.js";
import { GitHubMissionWorkspaceSpec } from "./GitHubMissionWorkspaceTypes.js";

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const manager = new GitHubMissionWorkspaceManager();
  if (command === "prepare") {
    const [repository, baseBranch, missionBranch, workspaceRoot] = args;
    if (!repository || !baseBranch || !missionBranch || !workspaceRoot) {
      throw new Error("Usage: github-workspace prepare <owner/repo> <base-branch> <keynu/mission-branch> <workspace-root>");
    }
    console.log(JSON.stringify(await manager.prepare(GitHubMissionWorkspaceSpec.parse({
      repository, baseBranch, missionBranch, workspaceRoot,
    })), null, 2));
    return;
  }
  if (command === "inspect") {
    if (!args[0]) throw new Error("Usage: github-workspace inspect <project-root>");
    console.log(JSON.stringify(await manager.inspect(args[0]), null, 2));
    return;
  }
  throw new Error("Usage: github-workspace <prepare|inspect> ...");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
