import type { CommandExecutionResult } from "../runtime/CommandExecutionResult.js";
import type { CommandSpec } from "../runtime/CommandSpec.js";

export type EngineeringAction =
  | "fs.readFile"
  | "fs.writeFile"
  | "fs.createFolder"
  | "fs.listDirectory"
  | "fs.exists"
  | "command.run"
  | "script.run"
  | "git.status"
  | "git.currentBranch"
  | "git.diff"
  | "git.log"
  | "git.createBranch"
  | "git.switchBranch"
  | "git.stage"
  | "git.commit"
  | "project.verify";

export type EngineeringPayload = {
  projectRoot: string;
  path?: string;
  content?: string;
  command?: CommandSpec;
  runtime?: "node" | "powershell" | "python" | "bash";
  script?: string;
  args?: string[];
  timeoutMs?: number;
  staged?: boolean;
  limit?: number;
  branch?: string;
  paths?: string[];
  message?: string;
  commands?: CommandSpec[];
};

export type EngineeringOperationResult = {
  action: EngineeringAction;
  projectRoot: string;
  success: boolean;
  summary: string;
  data?: unknown;
  changed?: string[];
  commandResults?: CommandExecutionResult[];
};
