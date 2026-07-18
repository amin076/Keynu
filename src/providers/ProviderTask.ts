export type ProviderTaskType =
  | 'start-session'
  | 'send-message'
  | 'execute-kap'
  | 'generate-text'
  | 'custom';

export type ProviderTask = {
  id: string;
  type: ProviderTaskType;
  providerId?: string;
  sessionId?: string;
  missionProjectId?: string;
  missionId?: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
};
