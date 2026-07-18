import type { ProviderCapabilities } from './ProviderCapabilities.js';
import type { ProviderResult } from './ProviderResult.js';
import type { ProviderSession } from './ProviderSession.js';
import type { ProviderTask } from './ProviderTask.js';

export type AIProviderStartOptions = {
  session: ProviderSession;
  task?: ProviderTask;
};

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  createSession(input?: Partial<ProviderSession>): ProviderSession;
  start(options: AIProviderStartOptions): Promise<ProviderResult>;
  stop?(session: ProviderSession): Promise<ProviderResult>;
  execute?(task: ProviderTask, session?: ProviderSession): Promise<ProviderResult>;
}
