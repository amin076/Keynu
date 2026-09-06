import axios from "axios";
import type {
  AppConnectorManifest,
  IntegrationConnector,
  IntegrationInvocationContext,
} from "../IntegrationTypes.js";

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function objectOrUndefined(value: unknown, label: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export class HttpConnector implements IntegrationConnector {
  readonly kind = "http" as const;

  async invoke(connector: AppConnectorManifest, context: IntegrationInvocationContext) {
    const config = connector.config ?? {};
    const request = context.capability.request ?? {};
    const baseUrl = new URL(requireString(config.baseUrl, `HTTP connector '${connector.id}' baseUrl`));
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      throw new Error(`HTTP connector '${connector.id}' only supports http/https baseUrl values.`);
    }

    const path = requireString(request.path, `HTTP capability '${context.capability.name}' request.path`);
    if (/^https?:\/\//i.test(path) || path.startsWith("//")) {
      throw new Error("HTTP capability request.path must be relative to the manifest-declared baseUrl.");
    }
    const target = new URL(path, baseUrl);
    if (target.origin !== baseUrl.origin) {
      throw new Error("HTTP capability target may not escape the manifest-declared origin.");
    }

    const method = String(request.method ?? "GET").toUpperCase();
    const allowedMethods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
    if (!allowedMethods.has(method)) throw new Error(`Unsupported HTTP method '${method}'.`);

    const timeout =
      typeof context.input.timeoutMs === "number"
        ? context.input.timeoutMs
        : typeof request.timeoutMs === "number"
          ? request.timeoutMs
          : typeof config.timeoutMs === "number"
            ? config.timeoutMs
            : 30_000;

    const response = await axios.request({
      baseURL: baseUrl.toString(),
      url: path,
      method,
      params: objectOrUndefined(context.input.query, "HTTP input.query"),
      data: context.input.body,
      headers: {
        ...objectOrUndefined(config.headers, `HTTP connector '${connector.id}' headers`),
        ...objectOrUndefined(request.headers, `HTTP capability '${context.capability.name}' request.headers`),
      },
      timeout,
      validateStatus: () => true,
    });

    const success = response.status >= 200 && response.status < 300;
    return {
      success,
      message: success
        ? `${context.app.name} capability '${context.capability.name}' completed through HTTP connector.`
        : `${context.app.name} capability '${context.capability.name}' returned HTTP ${response.status}.`,
      data: {
        appId: context.app.id,
        capability: context.capability.name,
        connector: connector.id,
        connectorKind: this.kind,
        status: response.status,
        statusText: response.statusText,
        body: response.data,
      },
    };
  }
}
