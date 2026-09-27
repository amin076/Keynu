import { resolve } from "node:path";
import { GitHubMissionOrchestrator } from "./GitHubMissionOrchestrator.js";

async function main() {
  const [repository, baseBranch, missionBranch, workspaceRoot, planTemplate, preparedPlanDirectory] = process.argv.slice(2);
  if (!repository || !baseBranch || !missionBranch || !workspaceRoot || !planTemplate || !preparedPlanDirectory) {
    throw new Error("Usage: github-mission <owner/repo> <base-branch> <keynu/mission-branch> <workspace-root> <plan-template> <prepared-plan-directory>");
  }
  const result = await new GitHubMissionOrchestrator().prepare({
    repository,
    baseBranch,
    missionBranch,
    workspaceRoot: resolve(workspaceRoot),
    planTemplate: resolve(planTemplate),
    preparedPlanDirectory: resolve(preparedPlanDirectory),
  });
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
