import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { z } from "zod";
import { ExecutionPlan } from "../mission/execution/ExecutionPlan.js";
import { GitHubMissionWorkspaceManager } from "./GitHubMissionWorkspaceManager.js";

export const GitHubMissionRequest = z.object({
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  baseBranch: z.string().regex(/^[A-Za-z0-9._/-]+$/).default("main"),
  missionBranch: z.string().regex(/^keynu\/[A-Za-z0-9._/-]+$/),
  workspaceRoot: z.string().min(1),
  planTemplate: z.string().min(1),
  preparedPlanDirectory: z.string().min(1),
}).strict();
export type GitHubMissionRequest = z.infer<typeof GitHubMissionRequest>;

export class GitHubMissionOrchestrator {
  constructor(private readonly workspaces = new GitHubMissionWorkspaceManager()) {}

  async prepare(input: GitHubMissionRequest) {
    const request = GitHubMissionRequest.parse(input);
    const workspace = await this.workspaces.prepare({
      repository: request.repository,
      baseBranch: request.baseBranch,
      missionBranch: request.missionBranch,
      workspaceRoot: request.workspaceRoot,
    });

    const templatePath = resolve(request.planTemplate);
    const template = ExecutionPlan.parse(JSON.parse(await readFile(templatePath, "utf8")));
    const prepared = ExecutionPlan.parse({
      ...template,
      projectRoot: workspace.projectRoot,
      rules: [
        ...template.rules,
        `GitHub source: ${request.repository}@${request.baseBranch}.`,
        `Mission branch: ${request.missionBranch}.`,
        `Pinned base commit: ${workspace.baseCommit}.`,
      ],
    });

    const directory = resolve(request.preparedPlanDirectory);
    await mkdir(directory, { recursive: true });
    const output = join(directory, `${prepared.id}.prepared.json`);
    await writeFile(output, JSON.stringify(prepared, null, 2) + "\n", { flag: "wx" });

    return {
      workspace,
      preparedPlan: output,
      planId: prepared.id,
      next: {
        add: `npm run mission -- add <config.json> ${output}`,
        run: "npm run mission -- run <config.json>",
        report: `npm run mission -- report <config.json> ${prepared.id}`,
      },
    };
  }
}
