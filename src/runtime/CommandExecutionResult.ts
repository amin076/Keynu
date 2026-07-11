export type CommandExecutionResult = {
  command: string;
  args: string[];
  cwd: string;
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};
