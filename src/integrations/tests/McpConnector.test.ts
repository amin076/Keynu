/**
 * McpConnector tests
 *
 * Uses InMemoryTransport + McpServer so no subprocess or network is needed.
 * A fresh server+connector pair is created per logical test group so teardown
 * is deterministic and tests are isolated.
 */

import { strict as assert } from "node:assert";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";

import { AppRegistry } from "../AppRegistry.js";
import { ConnectorRegistry } from "../ConnectorRegistry.js";
import { IntegrationHub } from "../IntegrationHub.js";
import {
  McpConnector,
  validateMcpConnectorConfig,
  type McpConnectorConfig,
} from "../connectors/McpConnector.js";
import type { AppManifest } from "../IntegrationTypes.js";

// ── Helper: build a linked in-memory server+transport pair ───────────────────

/**
 * Creates an McpServer with a set of test tools, starts it on the server
 * side of an InMemoryTransport, and returns a transport factory that always
 * returns the client-side transport for that exact server.
 *
 * The returned `closeServer` must be called to clean up after each test group.
 */
async function buildInMemoryServerAndFactory(serverName: string): Promise<{
  transportFactory: (config: McpConnectorConfig) => Promise<Transport>;
  closeServer: () => Promise<void>;
}> {
  const mcpServer = new McpServer({ name: serverName, version: "1.0.0" });

  // Tool: echo — returns its "message" argument as text.
  mcpServer.tool(
    "echo",
    "Return the input message unchanged.",
    { message: z.string() },
    async ({ message }: { message: string }) => ({
      content: [{ type: "text" as const, text: message }],
    }),
  );

  // Tool: add — adds two integers and returns the sum.
  mcpServer.tool(
    "add",
    "Add two numbers.",
    { a: z.number(), b: z.number() },
    async ({ a, b }: { a: number; b: number }) => ({
      content: [{ type: "text" as const, text: String(a + b) }],
    }),
  );

  // Tool: fail — always returns a tool-level error result.
  mcpServer.tool(
    "fail",
    "Always returns a tool error.",
    {},
    async () => ({
      isError: true,
      content: [{ type: "text" as const, text: "deliberate tool error" }],
    }),
  );

  // Create a single linked pair; the server side is connected once.
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await mcpServer.connect(serverTransport);

  // The factory always returns the same client-side transport.
  const transportFactory = async (_config: McpConnectorConfig): Promise<Transport> =>
    clientTransport;

  const closeServer = async () => {
    await mcpServer.close().catch(() => undefined);
  };

  return { transportFactory, closeServer };
}

// ── Test group helpers ────────────────────────────────────────────────────────

function makeMcpManifest(overrides: Partial<AppManifest> = {}): AppManifest {
  return {
    schemaVersion: "keynu-app-manifest-0.1",
    id: "test-mcp-app",
    name: "Test MCP App",
    connectors: [
      {
        id: "local-mcp",
        kind: "mcp",
        config: { transport: "stdio", command: "node", args: ["server.mjs"] },
      },
    ],
    capabilities: [
      {
        name: "echo",
        risk: "read",
        connector: "local-mcp",
        request: { tool: "echo" },
      },
    ],
    ...overrides,
  };
}

// ── 1. validateMcpConnectorConfig ────────────────────────────────────────────

console.log("  [1] validateMcpConnectorConfig …");

// Valid stdio config
const stdioConfig = validateMcpConnectorConfig(
  { transport: "stdio", command: "node", args: ["server.js"] },
  "test",
);
assert.equal(stdioConfig.transport, "stdio");
assert.equal((stdioConfig as Extract<typeof stdioConfig, { transport: "stdio" }>).command, "node");

// Valid http config
const httpConfig = validateMcpConnectorConfig(
  { transport: "http", url: "http://localhost:3000" },
  "test",
);
assert.equal(httpConfig.transport, "http");

// Missing transport → throws
assert.throws(
  () => validateMcpConnectorConfig({ command: "node" }, "test"),
  /transport must be "stdio" or "http"/i,
);

// Empty command → throws
assert.throws(
  () => validateMcpConnectorConfig({ transport: "stdio", command: "" }, "test"),
  /command must be a non-empty string/i,
);

// Blocked command → throws
assert.throws(
  () => validateMcpConnectorConfig({ transport: "stdio", command: "rm" }, "test"),
  /blocked/i,
);

// Bad args type → throws
assert.throws(
  () =>
    validateMcpConnectorConfig(
      { transport: "stdio", command: "node", args: "not-an-array" },
      "test",
    ),
  /args must be an array/i,
);

// Invalid URL → throws
assert.throws(
  () => validateMcpConnectorConfig({ transport: "http", url: "not-a-url" }, "test"),
  /not a valid URL/i,
);

// Non-http/https URL → throws
assert.throws(
  () => validateMcpConnectorConfig({ transport: "http", url: "ftp://example.com" }, "test"),
  /must use http or https/i,
);

// Token must be string if provided → throws
assert.throws(
  () =>
    validateMcpConnectorConfig({ transport: "http", url: "http://localhost", token: 42 }, "test"),
  /token must be a string/i,
);

console.log("  [1] validateMcpConnectorConfig ✓");

// ── 2. AppRegistry rejects bad MCP config at manifest load time ───────────────

console.log("  [2] AppRegistry early validation …");

const registry = new AppRegistry();

// Good manifest registers without error.
registry.register(makeMcpManifest());

// Missing transport → throws at register time, not at invocation.
assert.throws(
  () =>
    registry.register(
      makeMcpManifest({
        id: "bad-transport",
        connectors: [{ id: "mcp", kind: "mcp", config: { command: "node" } }],
      }),
    ),
  /transport must be "stdio" or "http"/i,
);

// Blocked command → throws at register time.
assert.throws(
  () =>
    registry.register(
      makeMcpManifest({
        id: "bad-cmd",
        connectors: [
          { id: "mcp", kind: "mcp", config: { transport: "stdio", command: "shutdown" } },
        ],
      }),
    ),
  /blocked/i,
);

// MCP capability missing request.tool → still registers (tool is validated at invocation).
// This is intentional: AppRegistry validates transport/config; tool-name validation
// happens when capabilities are invoked, consistent with how other connectors work.
const registryWithMissingTool = new AppRegistry();
registryWithMissingTool.register(
  makeMcpManifest({
    id: "missing-tool",
    capabilities: [{ name: "echo", risk: "read", connector: "local-mcp" }],
  }),
);

console.log("  [2] AppRegistry early validation ✓");

// ── 3. ConnectorRegistry and IntegrationHub wiring ───────────────────────────

console.log("  [3] ConnectorRegistry and builtin registration …");

const connectors = new ConnectorRegistry();
connectors.register(new McpConnector());
assert.equal(connectors.list().includes("mcp"), true);

// Double registration → throws.
assert.throws(
  () => connectors.register(new McpConnector()),
  /already registered/i,
);

console.log("  [3] ConnectorRegistry and builtin registration ✓");

// ── 4. Successful tool invocation via IntegrationHub ─────────────────────────

console.log("  [4] Successful tool invocation …");

{
  const { transportFactory, closeServer } = await buildInMemoryServerAndFactory("echo-server");
  try {
    const apps = new AppRegistry();
    apps.register({
      schemaVersion: "keynu-app-manifest-0.1",
      id: "echo-app",
      name: "Echo App",
      connectors: [
        {
          id: "local-mcp",
          kind: "mcp",
          config: { transport: "stdio", command: "node", args: ["server.mjs"] },
        },
      ],
      capabilities: [
        {
          name: "echo",
          risk: "read",
          connector: "local-mcp",
          request: { tool: "echo" },
        },
      ],
    });

    const connectorReg = new ConnectorRegistry();
    connectorReg.register(new McpConnector({ transportFactory }));
    const hub = new IntegrationHub({ appRegistry: apps, connectorRegistry: connectorReg });

    const result = await hub.invoke("echo-app", "echo", {
      arguments: { message: "hello keynu" },
    });

    assert.equal(result.success, true, "echo invocation should succeed");
    const data = result.data as Record<string, unknown>;
    assert.equal(data.tool, "echo");
    assert.equal(data.isError, false);
    const content = data.content as Array<{ type: string; text: string }>;
    assert.equal(content[0].text, "hello keynu");
  } finally {
    await closeServer();
  }
}

console.log("  [4] Successful tool invocation ✓");

// ── 5. Static manifest arguments merged with dynamic input arguments ──────────

console.log("  [5] Argument merging …");

{
  const { transportFactory, closeServer } = await buildInMemoryServerAndFactory("add-server");
  try {
    const apps = new AppRegistry();
    apps.register({
      schemaVersion: "keynu-app-manifest-0.1",
      id: "math-app",
      name: "Math App",
      connectors: [
        {
          id: "local-mcp",
          kind: "mcp",
          config: { transport: "stdio", command: "node", args: ["server.mjs"] },
        },
      ],
      capabilities: [
        {
          name: "add-with-base",
          risk: "read",
          connector: "local-mcp",
          // Static argument: a=10 from the manifest.
          request: { tool: "add", arguments: { a: 10 } },
        },
      ],
    });

    const connectorReg = new ConnectorRegistry();
    connectorReg.register(new McpConnector({ transportFactory }));
    const hub = new IntegrationHub({ appRegistry: apps, connectorRegistry: connectorReg });

    // Dynamic input provides b=5; static manifest provides a=10.
    const result = await hub.invoke("math-app", "add-with-base", {
      arguments: { b: 5 },
    });

    assert.equal(result.success, true, "add invocation should succeed");
    const content = (result.data as Record<string, unknown>).content as Array<{ text: string }>;
    assert.equal(content[0].text, "15", "10 + 5 should equal 15");
  } finally {
    await closeServer();
  }
}

console.log("  [5] Argument merging ✓");

// ── 6. Tool error (isError: true) surfaces as success:false ──────────────────

console.log("  [6] Tool error handling …");

{
  const { transportFactory, closeServer } = await buildInMemoryServerAndFactory("fail-server");
  try {
    const apps = new AppRegistry();
    apps.register({
      schemaVersion: "keynu-app-manifest-0.1",
      id: "fail-app",
      name: "Fail App",
      connectors: [
        {
          id: "local-mcp",
          kind: "mcp",
          config: { transport: "stdio", command: "node", args: ["server.mjs"] },
        },
      ],
      capabilities: [
        { name: "fail", risk: "read", connector: "local-mcp", request: { tool: "fail" } },
      ],
    });

    const connectorReg = new ConnectorRegistry();
    connectorReg.register(new McpConnector({ transportFactory }));
    const hub = new IntegrationHub({ appRegistry: apps, connectorRegistry: connectorReg });

    const result = await hub.invoke("fail-app", "fail", {});
    assert.equal(result.success, false, "tool error should produce success:false");
    assert.equal((result.data as Record<string, unknown>).isError, true);
  } finally {
    await closeServer();
  }
}

console.log("  [6] Tool error handling ✓");

// ── 7. Missing request.tool → throws at invocation ───────────────────────────

console.log("  [7] Missing request.tool validation …");

{
  const { transportFactory, closeServer } = await buildInMemoryServerAndFactory("noop-server");
  try {
    const apps = new AppRegistry();
    apps.register({
      schemaVersion: "keynu-app-manifest-0.1",
      id: "notool-app",
      name: "No-Tool App",
      connectors: [
        {
          id: "local-mcp",
          kind: "mcp",
          config: { transport: "stdio", command: "node" },
        },
      ],
      capabilities: [
        // Intentionally missing request.tool — should throw at invoke time.
        { name: "broken", risk: "read", connector: "local-mcp" },
      ],
    });

    const connectorReg = new ConnectorRegistry();
    connectorReg.register(new McpConnector({ transportFactory }));
    const hub = new IntegrationHub({ appRegistry: apps, connectorRegistry: connectorReg });

    await assert.rejects(
      () => hub.invoke("notool-app", "broken", {}),
      /request\.tool/i,
    );
  } finally {
    await closeServer();
  }
}

console.log("  [7] Missing request.tool validation ✓");

console.log("McpConnector tests passed.");
