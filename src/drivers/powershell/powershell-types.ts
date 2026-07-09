export type PowerShellCommandSpec = {
  command: string;
  args?: string[];
  timeoutMs?: number;
};

export type PowerShellCommandResult = {
  command: string;
  args: string[];
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export type PowerShellReadFileSpec = {
  path: string;
  maxBytes?: number;
};

export type PowerShellReadFileResult = {
  path: string;
  ok: boolean;
  content?: string;
  bytes?: number;
  error?: string;
};

export type PowerShellWriteFileSpec = {
  path: string;
  content: string;
  overwrite?: boolean;
};

export type PowerShellWriteFileResult = {
  path: string;
  ok: boolean;
  bytes?: number;
  error?: string;
};

export type PowerShellFileOpsJobPayload = {
  target: "powershell";
  cwd: string;
  readFiles?: PowerShellReadFileSpec[];
  writeFiles?: PowerShellWriteFileSpec[];
  commands?: PowerShellCommandSpec[];
  includeGit?: boolean;
};

export type KapJob<TPayload = unknown> = {
  protocol: "KAP";
  version: string;
  type: "JOB";
  id: string;
  createdAt?: string;
  payload: TPayload;
};

export type KapReport<TPayload = unknown> = {
  protocol: "KAP";
  version: string;
  type: "REPORT";
  id: string;
  createdAt: string;
  payload: TPayload;
};
