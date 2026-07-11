export type KeynuRuntimeState =
  | "starting"
  | "idle"
  | "reading-job"
  | "executing"
  | "posting-report"
  | "error"
  | "stopped";

export type KeynuSession = {
  version: 1;
  conversationUrl?: string;
  conversationId?: string;
  memoryRestored: boolean;
  runtimeState: KeynuRuntimeState;
  lastJobId?: string;
  lastReportId?: string;
  lastReportStatus?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type KeynuSessionPatch = Partial<Omit<KeynuSession, "version" | "createdAt">>;
