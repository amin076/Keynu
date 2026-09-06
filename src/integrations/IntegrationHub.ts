import { resolve } from "node:path";
import type { DriverResult } from "../core/Driver.js";
import { MissionRegistry } from "../mission/MissionRegistry.js";
import { AppRegistry } from "./AppRegistry.js";
import { ConnectorRegistry } from "./ConnectorRegistry.js";
import type {
  AppCapabilityManifest,
  AppManifest,
  IntegrationInvocationContext,
  IntegrationPack,
} from "./IntegrationTypes.js";

export type IntegrationHubOptions = {
  appRegistry?: AppRegistry;
  connectorRegistry?: ConnectorRegistry;
  missionRegistry?: MissionRegistry;
};

function objectInput(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Integration capability input must be an object.");
  }
  return value as Record<string, unknown>;
}

export class IntegrationHub {
  readonly apps: AppRegistry;
  readonly connectors: ConnectorRegistry;
  private readonly missionRegistry: MissionRegistry;
  private readonly packs = new Map<string, IntegrationPack>();

  constructor(options: IntegrationHubOptions = {}) {
    this.apps = options.appRegistry ?? new AppRegistry();
    this.connectors = options.connectorRegistry ?? new ConnectorRegistry();
    this.missionRegistry = options.missionRegistry ?? new MissionRegistry();
  }

  async loadManifests(directory: string): Promise<AppManifest[]> {
    return await this.apps.loadDirectory(directory);
  }

  registerPack(pack: IntegrationPack): void {
    if (this.packs.has(pack.appId)) throw new Error(`Integration pack '${pack.appId}' is already registered.`);
    this.packs.set(pack.appId, pack);
  }

  listApps(): AppManifest[] {
    return this.apps.list();
  }

  describeApp(appId: string): AppManifest {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`App '${appId}' is not registered.`);
    return app;
  }

  listCapabilities(appId: string): AppCapabilityManifest[] {
    return [...this.describeApp(appId).capabilities].sort((a, b) => a.name.localeCompare(b.name));
  }

  async invoke(appId: string, capabilityName: string, inputValue?: unknown): Promise<DriverResult> {
    const app = this.describeApp(appId);
    const capability = app.capabilities.find((entry) => entry.name === capabilityName);
    if (!capability) throw new Error(`App '${appId}' does not declare capability '${capabilityName}'.`);
    const input = objectInput(inputValue);
    const projectRoot = this.resolveProjectRoot(app, input);
    const context: IntegrationInvocationContext = { app, capability, projectRoot, input };

    if (capability.handler === "pack") {
      const pack = this.packs.get(app.id);
      if (!pack) throw new Error(`App '${app.id}' capability '${capability.name}' requires an integration pack.`);
      return await pack.invoke(capability.name, input, context);
    }

    const connectorManifest = app.connectors?.find((entry) => entry.id === capability.connector);
    if (!connectorManifest) {
      throw new Error(`App '${app.id}' capability '${capability.name}' connector '${capability.connector}' is not registered in its manifest.`);
    }
    const connector = this.connectors.get(connectorManifest.kind);
    if (!connector) {
      throw new Error(`No Keynu connector implementation is registered for kind '${connectorManifest.kind}'.`);
    }
    return await connector.invoke(connectorManifest, context);
  }

  private resolveProjectRoot(app: AppManifest, input: Record<string, unknown>): string {
    if (typeof input.projectRoot === "string" && input.projectRoot.trim()) {
      return resolve(input.projectRoot.trim());
    }
    if (app.rootEnv) {
      const envRoot = process.env[app.rootEnv];
      if (envRoot?.trim()) return resolve(envRoot.trim());
    }
    if (app.projectId) {
      return this.missionRegistry.getProject(app.projectId).root;
    }
    return process.cwd();
  }
}
