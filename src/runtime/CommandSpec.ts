export type CommandSpec = {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  runAfterFailure?: boolean;
  runtime?: 'node' | 'powershell' | 'python' | 'bash';
  script?: string;
  cleanup?: boolean;
};

export function isCommandSpec(value: unknown): value is CommandSpec {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CommandSpec>;
  return typeof candidate.command === 'string' && candidate.command.trim().length > 0;
}
