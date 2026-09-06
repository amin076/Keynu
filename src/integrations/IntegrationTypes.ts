import type { DriverResult } from "../core/Driver.js";

export const APP_MANIFEST_SCHEMA_VERSION = "keynu-app-manifest-0.1" as const;

export type ConnectorKind =
  | "cli"
  | "file"
  | "http"
  | "browser"
  | "mcp"
  | "websocket"
  | "custom";

export type IntegrationRisk = "read" | "write" | "execute";
export type IntegrationHandler = "connector" | "pack";

export type AppConnectorManifest = {
  id: string;
  kind: ConnectorKind;
  config?: Record<string, unknown>;
};

export type AppCapabilityManifest = {
  name: string;
  description?: string;
  risk: IntegrationRisk;
  handler?: IntegrationHandler;
  connector?: string;
  request?: Record<string, unknown>;
};

export type AppManifest = {
  schemaVersion: typeof APP_MANIFEST_SCHEMA_VERSION;
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  rootEnv?: string;
  connectors?: AppConnectorManifest[];
  capabilities: AppCapabilityManifest[];
};

export type IntegrationInvocationContext = {
  app: AppManifest;
  capability: AppCapabilityManifest;
  projectRoot: string;
  input: Record<string, unknown>;
};

export interface IntegrationConnector {
  readonly kind: ConnectorKind;
  invoke(
    connector: AppConnectorManifest,
    context: IntegrationInvocationContext,
  ): Promise<DriverResult>;
}

export interface IntegrationPack {
  readonly appId: string;
  invoke(
    capability: string,
    input: Record<string, unknown>,
    context: IntegrationInvocationContext,
  ): Promise<DriverResult>;
}
