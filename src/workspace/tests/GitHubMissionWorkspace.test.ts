import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeCommand } from "../../runtime/CommandExecutor.js";
import { GitHubMissionWorkspaceManager } from "../GitHubMissionWorkspaceManager.js";
import { GitHubMissionWorkspaceSpec } from "../GitHubMissionWorkspaceTypes.js";

assert.throws(() => GitHubMissionWorkspaceSpec.parse({
  repository: "owner/repo",
  baseBranch: "main",
  missionBranch: "main",
  workspaceRoot: ".tmp",
}), /Invalid string/i);
assert.throws(() => GitHubMissionWorkspaceSpec.parse({
  repository: "https://github.com/owner/repo",
  baseBranch: "main",
  missionBranch: "keynu/demo",
  workspaceRoot: ".tmp",
}));

// Exercise inspect() against a local repository so CI does not depend on GitHub network access.
const root = await mkdtemp(join(tmpdir(), "keynu-github-workspace-"));
const repo = join(root, "repo");
try {
  await import("node:fs/promises").then(({ mkdir }) => mkdir(repo));
  for (const args of [
    ["init"],
    ["config", "user.email", "keynu-test@example.invalid"],
    ["config", "user.name", "Keynu Test"],
  ]) {
    const result = await executeCommand({ command: "git", args, timeoutMs: 30_000 }, repo);
    assert.equal(result.ok, true, result.stderr);
  }
  await writeFile(join(repo, "README.md"), "fixture\n", "utf8");
  assert.equal((await executeCommand({ command: "git", args: ["add", "README.md"] }, repo)).ok, true);
  assert.equal((await executeCommand({ command: "git", args: ["commit", "-m", "fixture"] }, repo)).ok, true);
  assert.equal((await executeCommand({ command: "git", args: ["switch", "-c", "keynu/test-mission"] }, repo)).ok, true);
  await writeFile(join(repo, "README.md"), "fixture\nchanged\n", "utf8");

  const inspection = await new GitHubMissionWorkspaceManager().inspect(repo);
  assert.equal(inspection.branch, "keynu/test-mission");
  assert.match(inspection.status, /README\.md/);
  assert.match(inspection.diffStat, /README\.md/);
  assert.equal(await readFile(join(repo, "README.md"), "utf8"), "fixture\nchanged\n");
  console.log("GitHub mission workspace tests passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
