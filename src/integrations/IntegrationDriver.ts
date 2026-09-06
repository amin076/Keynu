import { fileURLToPath } from "node:url";
import type { CapabilityRegistry } from "../core/CapabilityRegistry.js";
import type { Driver, DriverResult } from "../core/Driver.js";
import { IntegrationHub } from "./IntegrationHub.js";

export type IntegrationDriverOptions = {
  hub?: IntegrationHub;
  capabilityRegistry?: CapabilityRegistry;
  manifestDirectory?: string;
};

const DEFAULT_MANIFEST_DIRECTORY = fileURLToPath(
  new URL("../../config/integrations/", import.meta.url),
);

export class IntegrationDriver implements Driver {
  readonly id = "integration";
  readonly name = "Keynu Integration Hub";
  readonly status = "Registered";
  readonly capabilities: string[] = ["listApps", "describeApp", "listCapabilities", "invoke"];

  readonly hub: IntegrationHub;
  private readonly capabilityRegistry?: CapabilityRegistry;
  private readonly manifestDirectory: string;

  constructor(options: IntegrationDriverOptions = {}) {
    this.hub = options.hub ?? new IntegrationHub();
    this.capabilityRegistry = options.capabilityRegistry;
    this.manifestDirectory = options.manifestDirectory ?? DEFAULT_MANIFEST_DIRECTORY;
  }

  async initialize(): Promise<void> {
    const apps = await this.hub.loadManifests(this.manifestDirectory);
    for (const app of apps) {
      for (const capability of app.capabilities) {
        const name = `${app.id}.${capability.name}`;
        this.capabilities.push(name);
        if (this.capabilityRegistry && !this.capabilityRegistry.has(name)) {
          this.capabilityRegistry.register({
            name,
            driver: this.id,
            action: `app:${app.id}:${capability.name}`,
            description: capability.description,
          });
        }
      }
    }
  }

  async execute(command: unknown): Promise<DriverResult> {
    if (!command || typeof command !== "object") throw new Error("Integration Hub requires a command object.");
    const record = command as Record<string, unknown>;
    const action = record.action;
    const payload =
      record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
        ? (record.payload as Record<string, unknown>)
        : {};
    if (typeof action !== "string" || !action.trim()) throw new Error("Integration Hub action must be a non-empty string.");

    if (action.startsWith("app:")) {
      const [, appId, ...parts] = action.split(":");
      const capability = parts.join(":");
      return await this.hub.invoke(appId, capability, payload);
    }

    switch (action) {
      case "listApps":
        return {
          success: true,
          message: "Registered applications listed successfully.",
          data: this.hub.listApps().map((app) => ({
            id: app.id,
            name: app.name,
            description: app.description,
            projectId: app.projectId,
            connectors: (app.connectors ?? []).map((connector) => ({ id: connector.id, kind: connector.kind })),
            capabilityCount: app.capabilities.length,
          })),
        };
      case "describeApp": {
        const appId = String(payload.appId ?? "");
        return { success: true, message: `Application '${appId}' described.`, data: this.hub.describeApp(appId) };
      }
      case "listCapabilities": {
        const appId = String(payload.appId ?? "");
        return { success: true, message: `Application '${appId}' capabilities listed.`, data: this.hub.listCapabilities(appId) };
      }
      case "invoke": {
        const appId = String(payload.appId ?? "");
        const capability = String(payload.capability ?? "");
        return await this.hub.invoke(appId, capability, payload.input);
      }
      default:
        throw new Error(`Unsupported Integration Hub action: ${action}`);
    }
  }
}
