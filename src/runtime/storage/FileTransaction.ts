import { mkdir, rm, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

/** Local-filesystem lock. Never steal a lock from a possibly running owner. */
export async function withFileLock<T>(path: string, action: () => Promise<T>): Promise<T> {
  await mkdir(dirname(path), { recursive: true });
  const lock = `${path}.lock`;
  const deadline = Date.now() + 5000;
  while (true) {
    try { await mkdir(lock); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new Error(`Store busy: ${lock}. If its owner crashed, stop all writers before removing this lock directory.`);
      await delay(20);
    }
  }
  try { return await action(); }
  finally { await rm(lock, { recursive: true, force: true }); }
}

export async function atomicJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    await rename(temp, path);
  } finally { await rm(temp, { force: true }); }
}
