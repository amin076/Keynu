import type { KapEnvelope } from '../kap/KapEnvelope.js';

export type RuntimeEventType =
  | 'response.interpreted'
  | 'kap.detected'
  | 'kap.validated'
  | 'kap.invalid'
  | 'dispatch.completed'
  | 'dispatch.skipped'
  | 'runtime.completed'
  | 'runtime.failed';

export type RuntimeEvent = {
  type: RuntimeEventType;
  message: string;
  envelope?: KapEnvelope;
  blockId?: string;
  metadata?: Record<string, unknown>;
};
