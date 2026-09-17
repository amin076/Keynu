import { realpath, lstat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname, sep } from 'node:path';

export async function projectPath(root: string, input: string): Promise<string> {
  const base = await realpath(root);
  const target = resolve(base, input);
  const inside = (path: string) => {
    const rel = relative(base, path);
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('Path outside project.');
    if (rel.split(sep).some(part => (['.git', '.keynu', 'node_modules', '.npmrc', '.pypirc'].includes(part.toLowerCase()) || /^\.env(?:\.|$)/i.test(part)))) {
      throw new Error('Protected project path.');
    }
  };
  inside(target);
  // Reject symbolic links, including dangling links and protected aliases.
  let cursor = target;
  while (cursor !== base) {
    try {
      if ((await lstat(cursor)).isSymbolicLink()) throw new Error('Symbolic links are not allowed for named file operations.');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    cursor = dirname(cursor);
  }
  return target;
}
