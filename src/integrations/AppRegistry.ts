import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  APP_MANIFEST_SCHEMA_VERSION,
  type AppCapabilityManifest,
  type AppConnectorManifest,
  type AppManifest,
} from "./IntegrationTypes.js";

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function requireAppId(value: unknown, label: string): string {
  if (typeof value !== "string" || !APP_ID_PATTERN.test(value)) {
    throw new Error(`${label} must match ${APP_ID_PATTERN}.`);
  }
  return value;
}

function requireToken(value: unknown, label: string): string {
  if (typeof value !== "string" || !TOKEN_PATTERN.test(value)) {
    throw new Error(`${label} must match ${TOKEN_PATTERN}.`);
  }
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function validateConnector(value: unknown, appId: string): AppConnectorManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`App '${appId}' connector must be an object.`);
  }
  const record = value as Record<string, unknown>;
  const id = requireToken(record.id, `App '${appId}' connector id`);
  const kind = requireString(record.kind, `App '${appId}' connector '${id}' kind`);
  if (!["cli", "file", "http", "browser", "mcp", "websocket", "custom"].includes(kind)) {
    throw new Error(`App '${appId}' connector '${id}' has unsupported kind '${kind}'.`);
  }
  if (record.config !== undefined && (!record.config || typeof record.config !== "object" || Array.isArray(record.config))) {
    throw new Error(`App '${appId}' connector '${id}' config must be an object.`);
  }
  return {
    id,
    kind: kind as AppConnectorManifest["kind"],
    config: record.config as Record<string, unknown> | undefined,
  };
}

function validateCapability(value: unknown, appId: string): AppCapabilityManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`App '${appId}' capability must be an object.`);
  }
  const record = value as Record<string, unknown>;
  const name = requireToken(record.name, `App '${appId}' capability name`);
  const risk = requireString(record.risk, `App '${appId}' capability '${name}' risk`);
  if (!["read", "write", "execute"].includes(risk)) {
    throw new Error(`App '${appId}' capability '${name}' has unsupported risk '${risk}'.`);
  }
  const handler = record.handler === undefined ? "connector" : requireString(record.handler, `App '${appId}' capability '${name}' handler`);
  if (handler !== "connector" && handler !== "pack") {
    throw new Error(`App '${appId}' capability '${name}' has unsupported handler '${handler}'.`);
  }
  if (handler === "connector" && typeof record.connector !== "string") {
    throw new Error(`App '${appId}' capability '${name}' must name a connector.`);
  }
  return {
    name,
    description: typeof record.description === "string" ? record.description : undefined,
    risk: risk as AppCapabilityManifest["risk"],
    handler,
    connector: typeof record.connector === "string" ? record.connector : undefined,
    request:
      record.request && typeof record.request === "object" && !Array.isArray(record.request)
        ? (record.request as Record<string, unknown>)
        : undefined,
  };
}

export function validateAppManifest(value: unknown): AppManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("App manifest must be an object.");
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== APP_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Unsupported app manifest schemaVersion: ${String(record.schemaVersion)}`);
  }
  const id = requireAppId(record.id, "App id");
  const name = requireString(record.name, `App '${id}' name`);
  const connectors = Array.isArray(record.connectors)
    ? record.connectors.map((entry) => validateConnector(entry, id))
    : [];
  if (!Array.isArray(record.capabilities) || record.capabilities.length === 0) {
    throw new Error(`App '${id}' must declare at least one capability.`);
  }
  const capabilities = record.capabilities.map((entry) => validateCapability(entry, id));
  const connectorIds = new Set<string>();
  for (const connector of connectors) {
    if (connectorIds.has(connector.id)) throw new Error(`App '${id}' connector '${connector.id}' is duplicated.`);
    connectorIds.add(connector.id);
  }
  const capabilityNames = new Set<string>();
  for (const capability of capabilities) {
    if (capabilityNames.has(capability.name)) throw new Error(`App '${id}' capability '${capability.name}' is duplicated.`);
    capabilityNames.add(capability.name);
    if (capability.handler !== "pack" && !connectorIds.has(capability.connector ?? "")) {
      throw new Error(`App '${id}' capability '${capability.name}' references unknown connector '${capability.connector}'.`);
    }
  }
  return {
    schemaVersion: APP_MANIFEST_SCHEMA_VERSION,
    id,
    name,
    description: typeof record.description === "string" ? record.description : undefined,
    projectId: typeof record.projectId === "string" ? record.projectId : undefined,
    rootEnv: typeof record.rootEnv === "string" ? record.rootEnv : undefined,
    connectors,
    capabilities,
  };
}

export class AppRegistry {
  private readonly apps = new Map<string, AppManifest>();

  register(manifestInput: AppManifest | unknown): AppManifest {
    const manifest = validateAppManifest(manifestInput);
    if (this.apps.has(manifest.id)) throw new Error(`App '${manifest.id}' is already registered.`);
    this.apps.set(manifest.id, manifest);
    return manifest;
  }

  get(id: string): AppManifest | undefined {
    return this.apps.get(id);
  }

  list(): AppManifest[] {
    return [...this.apps.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  async loadDirectory(directory: string): Promise<AppManifest[]> {
    const entries = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .sort((a, b) => a.name.localeCompare(b.name));
    const loaded: AppManifest[] = [];
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
      loaded.push(this.register(parsed));
    }
    return loaded;
  }
}
