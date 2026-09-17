import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { executeCommand } from '../../runtime/CommandExecutor.js';
import { FunctionRegistry } from './FunctionRegistry.js';
import { projectPath } from './ProjectPaths.js';

export function createBuiltinFunctions(): FunctionRegistry {
  const registry = new FunctionRegistry();
  registry.register('project.list', {
    description: 'List one project directory (no protected runtime or Git internals).',
    parameters: z.object({ path: z.string().default('.') }).strict(),
    execute: async ({ path }, { projectRoot }) => ({ ok: true, summary: 'Directory listed.',
      data: (await readdir(await projectPath(projectRoot, path))).slice(0, 1000) }),
  });
  registry.register('project.read', {
    description: 'Read a UTF-8 source file up to 128 KiB; returns SHA256 for guarded edits.',
    parameters: z.object({ path: z.string().min(1) }).strict(),
    execute: async ({ path }, { projectRoot }) => {
      const file = await projectPath(projectRoot, path);
      if ((await stat(file)).size > 131072) throw new Error('File exceeds read limit.');
      const content = await readFile(file, 'utf8');
      return { ok: true, summary: `Read ${path}`, data: { content, sha256: createHash('sha256').update(content).digest('hex') } };
    },
  });
  registry.register('project.write', {
    description: 'Write UTF-8 source; expectedSha256 required for existing files, null for new files. Parent must exist.',
    parameters: z.object({ path: z.string().min(1), content: z.string().max(131072),
      expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable() }).strict(),
    execute: async ({ path, content, expectedSha256 }, { projectRoot }) => {
      const file = await projectPath(projectRoot, path);
      if (expectedSha256 === null) await writeFile(file, content, { flag: 'wx' });
      else {
        const current = await readFile(file);
        if (createHash('sha256').update(current).digest('hex') !== expectedSha256) throw new Error('File changed since read.');
        await writeFile(file, content, 'utf8');
      }
      return { ok: true, summary: `Wrote ${path}`, data: { sha256: createHash('sha256').update(content).digest('hex') } };
    },
  });
  registry.register('git.status', {
    description: 'Inspect working tree status.', parameters: z.object({}).strict(),
    execute: async (_, { projectRoot }) => {
      const result = await executeCommand({ command: 'git', args: ['status', '--short'], timeoutMs: 30000 }, projectRoot);
      return { ok: result.ok, summary: result.ok ? 'Git status inspected.' : 'Git status failed.', data: result };
    },
  });
  return registry;
}
