/**
 * McpConnector — Keynu Integration Hub connector for Model Context Protocol servers.
 *
 * Supported transport kinds (declared in the app manifest connector config.transport):
 *   "stdio"  — spawns a local subprocess and communicates over stdin/stdout.
 *   "http"   — connects to an MCP server via Streamable HTTP (SSE or POST transport).
 *
 * Capability request fields (in the app manifest capability.request):
 *   tool        (string, required) — MCP tool name to invoke.
 *   arguments   (object, optional) — static argument overrides merged under input.arguments.
 *
 * Runtime input (passed by the caller at invocation time):
 *   arguments   (object, optional) — dynamic arguments merged with any static request.arguments.
 *
 * Security boundaries:
 *   - stdio command and args are validated the same way as EngineeringRuntime commands.
 *   - Secrets must not be placed in manifest config.env values that get logged; only
 *     well-known, non-sensitive vars should appear there. The caller is responsible for
 *     env hygiene.
 *   - Tool results are returned verbatim as Keynu DriverResult.data — Keynu does not
 *     execute the content of tool results as shell commands.
 *   - No automatic reconnect or retry logic to avoid masking failures.
 */

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  AppConnectorManifest,
  IntegrationConnector,
  IntegrationInvocationContext,
} from "../IntegrationTypes.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type McpTransportKind = "stdio" | "http";

export type McpStdioConfig = {
  transport: "stdio";
  /** Executable to spawn. Must not be empty. */
  command: string;
  /** Static arguments prepended before any capability-level args. */
  args?: string[];
  /** Environment variables forwarded to the subprocess.
   *  Do NOT place secrets here if log capture is enabled. */
  env?: Record<string, string>;
  /** Working directory for the subprocess. Defaults to process.cwd(). */
  cwd?: string;
};

export type McpHttpConfig = {
  transport: "http";
  /** Full base URL of the MCP server (http:// or https:// only). */
  url: string;
  /** Optional Bearer token for Authorization header.
   *  Value is never written to logs by this connector. */
  token?: string;
};

export type McpConnectorConfig = McpStdioConfig | McpHttpConfig;

// ── Validation helpers ────────────────────────────────────────────────────────

const BLOCKED_STDIO_COMMANDS = new Set([
  "format",
  "shutdown",
  "restart-computer",
  "rm",
  "del",
  "rmdir",
]);

/** Validates and narrows a raw config object from the manifest. Throws on any violation. */
export function validateMcpConnectorConfig(
  raw: unknown,
  connectorId: string,
): McpConnectorConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      `MCP connector '${connectorId}' config must be a non-null object.`,
    );
  }
  const config = raw as Record<string, unknown>;
  const transport = config.transport;

  if (transport !== "stdio" && transport !== "http") {
    throw new Error(
      `MCP connector '${connectorId}' config.transport must be "stdio" or "http".`,
    );
  }

  if (transport === "stdio") {
    const command = config.command;
    if (typeof command !== "string" || !command.trim()) {
      throw new Error(
        `MCP connector '${connectorId}' stdio config.command must be a non-empty string.`,
      );
    }
    if (BLOCKED_STDIO_COMMANDS.has(command.trim().toLowerCase())) {
      throw new Error(
        `MCP connector '${connectorId}' stdio config.command '${command}' is blocked.`,
      );
    }
    if (config.args !== undefined) {
      if (
        !Array.isArray(config.args) ||
        config.args.some((arg) => typeof arg !== "string")
      ) {
        throw new Error(
          `MCP connector '${connectorId}' stdio config.args must be an array of strings.`,
        );
      }
    }
    if (config.env !== undefined) {
      if (
        !config.env ||
        typeof config.env !== "object" ||
        Array.isArray(config.env) ||
        Object.values(config.env).some((value) => typeof value !== "string")
      ) {
        throw new Error(
          `MCP connector '${connectorId}' stdio config.env must be a string-valued object.`,
        );
      }
    }
    if (config.cwd !== undefined && typeof config.cwd !== "string") {
      throw new Error(
        `MCP connector '${connectorId}' stdio config.cwd must be a string.`,
      );
    }
    return {
      transport: "stdio",
      command: command.trim(),
      args: config.args as string[] | undefined,
      env: config.env as Record<string, string> | undefined,
      cwd: typeof config.cwd === "string" ? config.cwd : undefined,
    };
  }

  // http
  const url = config.url;
  if (typeof url !== "string" || !url.trim()) {
    throw new Error(
      `MCP connector '${connectorId}' http config.url must be a non-empty string.`,
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error(
      `MCP connector '${connectorId}' http config.url is not a valid URL.`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `MCP connector '${connectorId}' http config.url must use http or https.`,
    );
  }
  if (config.token !== undefined && typeof config.token !== "string") {
    throw new Error(
      `MCP connector '${connectorId}' http config.token must be a string.`,
    );
  }
  return {
    transport: "http",
    url: url.trim(),
    token: typeof config.token === "string" ? config.token : undefined,
  };
}

/** Validates capability request fields for MCP. */
function requireToolName(
  request: Record<string, unknown>,
  capabilityName: string,
): string {
  const tool = request.tool;
  if (typeof tool !== "string" || !tool.trim()) {
    throw new Error(
      `MCP capability '${capabilityName}' must declare request.tool as a non-empty string.`,
    );
  }
  return tool.trim();
}

// ── Transport factory ─────────────────────────────────────────────────────────

async function buildTransport(
  config: McpConnectorConfig,
): Promise<Transport> {
  if (config.transport === "stdio") {
    const { StdioClientTransport } = await import(
      "@modelcontextprotocol/sdk/client/stdio.js"
    );
    return new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
      cwd: config.cwd,
      // Pipe stderr so subprocess error output does not bleed into Keynu's stdout.
      stderr: "pipe",
    });
  }

  // http
  const { StreamableHTTPClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/streamableHttp.js"
  );
  const headers: Record<string, string> = {};
  if (config.token) {
    // Token is added to the Authorization header; it is never written to logs.
    headers["Authorization"] = `Bearer ${config.token}`;
  }
  return new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: { headers },
  });
}

// ── McpConnector ──────────────────────────────────────────────────────────────

export type McpTransportFactory = (
  config: McpConnectorConfig,
) => Promise<Transport>;

export type McpConnectorOptions = {
  /**
   * Override the transport factory. Used in tests to inject an in-memory
   * transport without spawning a subprocess or opening a network connection.
   */
  transportFactory?: McpTransportFactory;
};

/**
 * Connects to any MCP server and invokes a named tool on behalf of an
 * IntegrationHub capability. Each invocation creates a fresh connection so
 * there is no shared mutable state between calls and no idle connection to
 * manage or leak.
 */
export class McpConnector implements IntegrationConnector {
  readonly kind = "mcp" as const;

  private readonly transportFactory: McpTransportFactory;

  constructor(options: McpConnectorOptions = {}) {
    this.transportFactory = options.transportFactory ?? buildTransport;
  }

  async invoke(
    connector: AppConnectorManifest,
    context: IntegrationInvocationContext,
  ) {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");

    // Validate config eagerly at invocation time (manifest load-time
    // validation in AppRegistry is the primary guard; this is a second
    // line of defence for programmatically constructed connectors).
    const config = validateMcpConnectorConfig(
      connector.config,
      connector.id,
    );

    const request = context.capability.request ?? {};
    const toolName = requireToolName(request as Record<string, unknown>, context.capability.name);

    // Merge static manifest arguments with dynamic input arguments.
    const staticArgs =
      request.arguments &&
      typeof request.arguments === "object" &&
      !Array.isArray(request.arguments)
        ? (request.arguments as Record<string, unknown>)
        : {};
    const inputArgs =
      context.input.arguments &&
      typeof context.input.arguments === "object" &&
      !Array.isArray(context.input.arguments)
        ? (context.input.arguments as Record<string, unknown>)
        : {};
    const toolArguments = { ...staticArgs, ...inputArgs };

    const transport = await this.transportFactory(config);
    const client: Client = new Client(
      { name: "keynu-mcp-connector", version: "1.0.0" },
      { capabilities: {} },
    );

    try {
      await client.connect(transport);

      const result = await client.callTool({
        name: toolName,
        arguments: toolArguments,
      });

      const success = !result.isError;

      return {
        success,
        message: success
          ? `${context.app.name} capability '${context.capability.name}' completed through MCP connector (tool: ${toolName}).`
          : `${context.app.name} capability '${context.capability.name}' returned a tool error (tool: ${toolName}).`,
        data: {
          appId: context.app.id,
          capability: context.capability.name,
          connector: connector.id,
          connectorKind: this.kind,
          tool: toolName,
          isError: Boolean(result.isError),
          content: result.content,
        },
      };
    } finally {
      // Always close the transport, regardless of success or failure.
      await client.close().catch(() => undefined);
    }
  }
}
