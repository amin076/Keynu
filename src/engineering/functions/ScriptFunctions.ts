import { readFile, realpath, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { executeCommand } from '../../runtime/CommandExecutor.js';
import type { FunctionRegistry } from './FunctionRegistry.js';

export const ScriptDefinition = z.object({
  name: z.string(), description: z.string(), runtime: z.enum(['node', 'powershell']),
  script: z.string().min(1), timeoutMs: z.number().int().min(1).max(3600000).default(120000),
  fields: z.record(z.string(), z.enum(['string', 'number', 'boolean'])),
}).strict();

/** Trusted config registers an existing script. JSON arguments travel in a file, never shell source. */
export async function registerScript(registry: FunctionRegistry, input: unknown): Promise<void> {
  const definition = ScriptDefinition.parse(input);
  const script = await realpath(definition.script);
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const expectedHash = hash(await readFile(script));
  const fields = Object.fromEntries(Object.entries(definition.fields).map(([name, type]) => [name,
    type === 'string' ? z.string() : type === 'number' ? z.number() : z.boolean()]));
  registry.register(definition.name, {
    description: definition.description, parameters: z.object(fields).strict(),
    execute: async (args, { projectRoot }) => {
      if (hash(await readFile(script)) !== expectedHash) throw new Error('Registered script changed; reload trusted configuration before executing.');
      const directory = await mkdtemp(join(tmpdir(), 'keynu-args-'));
      const file = join(directory, 'arguments.json');
      try {
        await writeFile(file, JSON.stringify(args), { mode: 0o600 });
        const result = await executeCommand({
          command: definition.runtime === 'node' ? process.execPath : 'powershell',
          args: definition.runtime === 'node' ? [script, file] : ['-NoProfile', '-File', script, file],
          timeoutMs: definition.timeoutMs,
        }, projectRoot);
        return { ok: result.ok, summary: result.ok ? `${definition.name} completed.` : `${definition.name} failed.`, data: result };
      } finally { await rm(directory, { recursive: true, force: true }); }
    },
  });
}
