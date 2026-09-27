import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitHubMissionOrchestrator } from "../GitHubMissionOrchestrator.js";

const root = await mkdtemp(join(tmpdir(), "keynu-mission-orchestrator-"));
const workspace = join(root, "workspace", "repo");
const template = join(root, "template.json");
const prepared = join(root, "prepared");

const fakeWorkspace = {
  async prepare() {
    await mkdir(workspace, { recursive: true });
    return {
      repository: "amin076/science-web-lab",
      remoteUrl: "https://github.com/amin076/science-web-lab.git",
      baseBranch: "main",
      missionBranch: "keynu/esbiko-test",
      projectRoot: workspace,
      baseCommit: "0123456789abcdef0123456789abcdef01234567",
    };
  },
};

try {
  await writeFile(template, JSON.stringify({
    id: "esbiko-fixture",
    projectId: "esbiko",
    projectRoot: "placeholder",
    goal: "Make one bounded improvement.",
    rules: ["Do not deploy."],
    steps: [{
      id: "improve",
      goal: "Inspect and improve.",
      allowedFunctions: ["project.read"],
      verification: [{ name: "project.read", args: { path: "README.md" } }],
      maxAiCalls: 2
    }]
  }), "utf8");

  const result = await new GitHubMissionOrchestrator(fakeWorkspace as never).prepare({
    repository: "amin076/science-web-lab",
    baseBranch: "main",
    missionBranch: "keynu/esbiko-test",
    workspaceRoot: join(root, "workspaces"),
    planTemplate: template,
    preparedPlanDirectory: prepared,
  });
  const plan = JSON.parse(await readFile(result.preparedPlan, "utf8"));
  assert.equal(plan.projectRoot, workspace);
  assert.match(JSON.stringify(plan.rules), /Pinned base commit/);
  assert.match(JSON.stringify(plan.rules), /science-web-lab/);
  assert.equal(result.planId, "esbiko-fixture");
  console.log("GitHub mission orchestrator tests passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
