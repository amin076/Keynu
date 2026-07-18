export type ProviderSessionStatus =
  | 'created'
  | 'starting'
  | 'active'
  | 'stopped'
  | 'failed';

export type ProviderSession = {
  id: string;
  providerId: string;
  status: ProviderSessionStatus;
  missionProjectId?: string;
  missionId?: string;
  conversationUrl?: string;
  startedAt?: string;
  stoppedAt?: string;
  metadata?: Record<string, unknown>;
};
