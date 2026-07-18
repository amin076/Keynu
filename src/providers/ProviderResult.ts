import type { ProviderSession } from './ProviderSession.js';
import type { ProviderTask } from './ProviderTask.js';

export type ProviderResultStatus =
  | 'completed'
  | 'accepted'
  | 'skipped'
  | 'failed';

export type ProviderResult = {
  providerId: string;
  taskId: string;
  status: ProviderResultStatus;
  session?: ProviderSession;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
};

export function createProviderResult(
  providerId: string,
  task: ProviderTask,
  status: ProviderResultStatus,
  patch: Omit<ProviderResult, 'providerId' | 'taskId' | 'status'> = {},
): ProviderResult {
  return {
    providerId,
    taskId: task.id,
    status,
    ...patch,
  };
}
