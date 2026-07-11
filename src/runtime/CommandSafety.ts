import type { CommandSpec } from './CommandSpec.js';

const BLOCKED_COMMANDS = new Set(['format', 'shutdown', 'restart-computer']);

export function validateCommandSafety(spec: CommandSpec): { ok: true } | { ok: false; reason: string } {
  const command = spec.command.trim();
  if (!command) return { ok: false, reason: 'Command is empty.' };

  const lowered = command.toLowerCase();
  if (BLOCKED_COMMANDS.has(lowered)) {
    return { ok: false, reason: `Blocked command: ${command}` };
  }

  return { ok: true };
}
