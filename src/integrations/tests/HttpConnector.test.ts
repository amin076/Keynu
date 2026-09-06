import { strict as assert } from "node:assert";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { AppRegistry } from "../AppRegistry.js";
import { ConnectorRegistry } from "../ConnectorRegistry.js";
import { IntegrationHub } from "../IntegrationHub.js";
import { HttpConnector } from "../connectors/HttpConnector.js";

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ path: url.pathname, probe: url.searchParams.get("probe") }));
});

server.listen(0, "127.0.0.1");
await once(server, "listening");

try {
  const address = server.address() as AddressInfo;
  const apps = new AppRegistry();
  apps.register({
    schemaVersion: "keynu-app-manifest-0.1",
    id: "web-fixture",
    name: "Web Fixture",
    connectors: [
      {
        id: "api",
        kind: "http",
        config: { baseUrl: `http://127.0.0.1:${address.port}/` },
      },
    ],
    capabilities: [
      {
        name: "health",
        risk: "read",
        connector: "api",
        request: { method: "GET", path: "/health" },
      },
    ],
  });

  const connectors = new ConnectorRegistry();
  connectors.register(new HttpConnector());
  const hub = new IntegrationHub({ appRegistry: apps, connectorRegistry: connectors });
  const result = await hub.invoke("web-fixture", "health", { query: { probe: "keynu" } });

  assert.equal(result.success, true);
  const data = result.data as { status?: number; body?: { path?: string; probe?: string } };
  assert.equal(data.status, 200);
  assert.equal(data.body?.path, "/health");
  assert.equal(data.body?.probe, "keynu");

  await assert.rejects(
    hub.invoke("web-fixture", "missing", {}),
    /does not declare capability/i,
  );

  console.log("HttpConnector integration test passed.");
} finally {
  server.close();
  await once(server, "close");
}
