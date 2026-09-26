import { z } from "zod";

export const GitHubMissionWorkspaceSpec = z.object({
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  baseBranch: z.string().regex(/^[A-Za-z0-9._/-]+$/).default("main"),
  missionBranch: z.string().regex(/^keynu\/[A-Za-z0-9._/-]+$/),
  workspaceRoot: z.string().min(1),
}).strict();

export type GitHubMissionWorkspaceSpec = z.infer<typeof GitHubMissionWorkspaceSpec>;

export type GitHubMissionWorkspace = {
  repository: string;
  remoteUrl: string;
  baseBranch: string;
  missionBranch: string;
  projectRoot: string;
  baseCommit: string;
};
