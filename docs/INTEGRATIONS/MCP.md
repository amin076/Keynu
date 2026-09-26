# MCP Integration

Keynu supports connecting to any [Model Context Protocol](https://modelcontextprotocol.io) server through the existing Integration Hub architecture.

## How it works

An app manifest declares one or more connectors with `kind: "mcp"`. When a capability backed by an MCP connector is invoked via the Integration Hub, Keynu:

1. Validates the connector config at **manifest load time** (early, clear errors).
2. Creates a fresh MCP client connection per invocation (no shared state between calls).
3. Calls the named MCP tool with merged arguments (static from manifest + dynamic from caller).
4. Returns the tool result as a Keynu `DriverResult`, mapping `isError: true` to `success: false`.
5. Closes the connection unconditionally in a `finally` block.

The MCP connector is registered in the builtin Integration Hub alongside `cli`, `file`, and `http`.

## Supported transports

### `stdio`

Spawns a local subprocess and communicates over stdin/stdout. The subprocess stderr is piped (not forwarded to Keynu stdout).

```json
{
  "id": "my-mcp-server",
  "kind": "mcp",
  "config": {
    "transport": "stdio",
    "command": "node",
    "args": ["path/to/server.mjs"],
    "env": { "SOME_VAR": "value" },
    "cwd": "/optional/working/dir"
  }
}
```

### `http`

Connects to a remote or local MCP server using Streamable HTTP (SSE + POST transport).

```json
{
  "id": "my-remote-mcp",
  "kind": "mcp",
  "config": {
    "transport": "http",
    "url": "http://localhost:3100",
    "token": "optional-bearer-token"
  }
}
```

> **Security note:** `token` is sent in the `Authorization` header only; it is never written to Keynu logs.

## App manifest structure

```json
{
  "schemaVersion": "keynu-app-manifest-0.1",
  "id": "my-mcp-app",
  "name": "My MCP App",
  "connectors": [
    {
      "id": "server",
      "kind": "mcp",
      "config": {
        "transport": "stdio",
        "command": "node",
        "args": ["server.mjs"]
      }
    }
  ],
  "capabilities": [
    {
      "name": "get-weather",
      "description": "Fetch weather for a location.",
      "risk": "read",
      "connector": "server",
      "request": {
        "tool": "get_current_weather",
        "arguments": { "units": "celsius" }
      }
    }
  ]
}
```

`request.tool` (required) is the MCP tool name to invoke.  
`request.arguments` (optional) provides static argument values that are merged with any dynamic `arguments` passed at invocation time. Dynamic values override static ones for the same key.

## Capability declaration in `config/integrations/`

Place the manifest JSON in `config/integrations/`. It is loaded automatically when the Integration Driver initializes.

## Invoking via KAP

Once registered, a KAP job can invoke an MCP capability using the Integration Hub's `invoke` action:

```json
{
  "protocol": "KAP",
  "version": "1.0",
  "type": "JOB",
  "id": "job-001",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "payload": {
    "target": "engineering",
    "driver": "integration",
    "action": "invoke",
    "payload": {
      "appId": "my-mcp-app",
      "capability": "get-weather",
      "input": {
        "arguments": { "location": "London" }
      }
    }
  }
}
```

Or via the short-form capability name if registered in `CapabilityRegistry`:

```json
{
  "capability": "my-mcp-app.get-weather",
  "payload": {
    "arguments": { "location": "London" }
  }
}
```

## Minimal demonstration procedure

The following procedure connects Keynu to a local in-process MCP server and invokes one tool with no external dependencies, API keys, or network access.

### Step 1 — Create a minimal MCP server script

Create `demo-mcp-server.mjs` anywhere accessible:

```js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "demo", version: "1.0.0" });

server.tool(
  "greet",
  "Return a greeting.",
  { name: z.string() },
  async ({ name }) => ({
    content: [{ type: "text", text: `Hello, ${name}! — from Keynu MCP demo` }],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Step 2 — Create the app manifest

Create `config/integrations/demo-mcp.json`:

```json
{
  "schemaVersion": "keynu-app-manifest-0.1",
  "id": "demo-mcp",
  "name": "Demo MCP",
  "connectors": [
    {
      "id": "server",
      "kind": "mcp",
      "config": {
        "transport": "stdio",
        "command": "node",
        "args": ["demo-mcp-server.mjs"]
      }
    }
  ],
  "capabilities": [
    {
      "name": "greet",
      "description": "Greet a user via local MCP server.",
      "risk": "read",
      "connector": "server",
      "request": { "tool": "greet" }
    }
  ]
}
```

### Step 3 — Build and start Keynu

```
npm run build
npm run dev
```

### Step 4 — Drop a task in `inbox/`

Create `inbox/demo-mcp-task.json`:

```json
{
  "id": "demo-mcp-task-001",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "priority": "normal",
  "steps": [
    {
      "capability": "integration.invoke",
      "payload": {
        "appId": "demo-mcp",
        "capability": "greet",
        "input": { "arguments": { "name": "World" } }
      }
    }
  ]
}
```

### Step 5 — Observe the result

Keynu picks up the file, connects to the MCP server subprocess, calls the `greet` tool with `{ name: "World" }`, and logs the result. The completed task moves to `processed/`.

Expected result in the Keynu log:
```
Task completed: demo-mcp-task-001 (1 steps)
```

The `DriverResult.data.content` field will contain:
```json
[{ "type": "text", "text": "Hello, World! — from Keynu MCP demo" }]
```

## Security boundaries

| Boundary | Behaviour |
|---|---|
| Blocked stdio commands | `format`, `shutdown`, `restart-computer`, `rm`, `del`, `rmdir` are rejected at manifest load time. |
| Token confidentiality | Bearer token is sent in the `Authorization` header only; never logged. |
| No shell promotion | MCP tool results are data only; Keynu never executes them as shell commands. |
| One connection per invocation | No persistent connection pool; no shared state between invocations. |
| Transport validation | `transport` must be `"stdio"` or `"http"`. HTTP URLs must be `http://` or `https://`. |
| Manifest load-time validation | Invalid MCP config throws before the manifest is registered — no silent misconfiguration. |

## Limitations

- **Stdio transport is Windows-compatible** through Node's `child_process.spawn` but `node_modules/.bin` entries may require `.cmd` suffixes on Windows (the same pattern as `CommandExecutor`).
- **HTTP transport** uses `StreamableHTTPClientTransport` from the SDK. Servers using the legacy SSE-only transport will need an SDK-compatible endpoint.
- **One fresh connection per capability invocation**: for high-frequency calls this incurs one MCP initialization handshake per call. A persistent connection pool is a future improvement.
- **No MCP resource or prompt support**: only tool calls (`tools/call`) are exposed via this connector. Resources and prompts can be added as additional capability types in a future iteration.
- **No MCP roots support**: the connector does not currently advertise Keynu project roots to the MCP server via the `roots` capability. This may be needed for some filesystem-aware MCP servers.
