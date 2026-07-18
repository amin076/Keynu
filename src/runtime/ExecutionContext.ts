import type { ProviderResponse } from '../providers/api/ProviderResponse.js';

export type ExecutionContext = {
  providerId?: string;
  requestId?: string;
  responseId?: string;
  missionProjectId?: string;
  missionId?: string;
  source?: string;
  providerResponse?: ProviderResponse;
  metadata?: Record<string, unknown>;
};
