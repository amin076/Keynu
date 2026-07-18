export type ProviderTransport =
  | 'browser'
  | 'cli'
  | 'api'
  | 'local';

export type ProviderCapabilityName =
  | 'mission.bootstrap'
  | 'kap.receive'
  | 'kap.send'
  | 'conversation.watch'
  | 'continuation.request'
  | 'job.execute'
  | 'text.generate';

export type ProviderCapabilities = {
  transport: ProviderTransport;
  capabilities: ProviderCapabilityName[];
  supportsMissionBootstrap: boolean;
  supportsKap: boolean;
  supportsContinuation: boolean;
  supportsInteractiveSession: boolean;
};
