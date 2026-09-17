import { AsyncLocalStorage } from 'node:async_hooks';
import { realpath, readFile, writeFile, lstat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { withFileLock } from './FileTransaction.js';

// Cooperative ownership, not an OS security boundary. Child processes inherit a scoped
// token so project test commands can call Keynu without deadlocking their parent worker.
const owners = new AsyncLocalStorage<Map<string, string>>();
function inherited(): Map<string, string> {
  try {
    const value = JSON.parse(process.env.KEYNU_PROJECT_LOCK_CONTEXT ?? '[]');
    return new Map(Array.isArray(value) ? value.filter(item => Array.isArray(item) && item.length === 2 && item.every(x => typeof x === 'string')) : []);
  } catch { return new Map(); }
}
export function projectLockEnvironment(): NodeJS.ProcessEnv {
  return { ...process.env, KEYNU_PROJECT_LOCK_CONTEXT: JSON.stringify([...(owners.getStore() ?? inherited())]) };
}
export async function withProjectExecutionLock<T>(root: string, action: () => Promise<T>): Promise<T> {
  let canonical = await realpath(root);
  // All subdirectories of one Git checkout/worktree share its execution owner.
  for (let cursor = canonical; ; cursor = dirname(cursor)) {
    try { await lstat(join(cursor, '.git')); canonical = cursor; break; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (dirname(cursor) === cursor) break;
  }
  const key = process.platform === 'win32' ? canonical.toLowerCase() : canonical;
  const current = owners.getStore();
  if (current?.has(key)) return action();
  const path = join(canonical, '.keynu', 'state', 'mission-execution');
  const tokens = inherited();
  const token = tokens.get(key);
  if (token) {
    try {
      if ((await readFile(join(`${path}.lock`, 'owner'), 'utf8')) === token) {
        return owners.run(new Map([...(current ?? []), [key, token]]), action);
      }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return withFileLock(path, async () => {
    const token = randomUUID();
    await writeFile(join(`${path}.lock`, 'owner'), token, { mode: 0o600 });
    return owners.run(new Map([...(current ?? []), [key, token]]), action);
  });
}
