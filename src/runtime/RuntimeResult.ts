import type { KapEnvelope } from '../kap/KapEnvelope.js';
import type { ProviderResponse } from '../providers/api/ProviderResponse.js';
import type { ExecutionStatus } from './ExecutionStatus.js';
import type { RuntimeEvent } from './RuntimeEvent.js';

export type RuntimeDispatchAction =
  | 'JOB'
  | 'REPORT'
  | 'ERROR'
  | 'UNHANDLED';

export type RuntimeDispatchItem = {
  status: ExecutionStatus;
  action: RuntimeDispatchAction;
  envelope: KapEnvelope;
  blockId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

export type RuntimeResult = {
  status: ExecutionStatus;
  providerResponse?: ProviderResponse;
  text: string;
  items: RuntimeDispatchItem[];
  events: RuntimeEvent[];
  errors: string[];
  metadata?: Record<string, unknown>;
};
