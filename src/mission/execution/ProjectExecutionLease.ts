import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { withFileLock } from '../../runtime/storage/FileTransaction.js';

export function projectExecutionLockPath(projectRoot: string): string {
  if (!projectRoot.trim()) throw new Error('Project root is required for execution ownership.');
  const canonicalRoot = realpathSync(projectRoot);
  return join(canonicalRoot, '.keynu', 'state', 'mission-execution');
}

export async function withProjectExecutionLease<T>(
  projectRoot: string,
  operation: () => Promise<T>,
): Promise<T> {
  return withFileLock(projectExecutionLockPath(projectRoot), operation);
}
