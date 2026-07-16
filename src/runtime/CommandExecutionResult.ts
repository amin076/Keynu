export type CommandExecutionResult = {
  command: string;
  args: string[];
  cwd: string;
  ok: boolean;
  exitCode?: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};
