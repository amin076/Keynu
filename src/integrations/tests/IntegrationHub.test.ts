import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CapabilityRegistry } from "../../core/CapabilityRegistry.js";
import type { EngineeringAction, EngineeringOperationResult, EngineeringPayload } from "../../engineering/EngineeringTypes.js";
import { AppRegistry } from "../AppRegistry.js";
import { ConnectorRegistry } from "../ConnectorRegistry.js";
import { IntegrationDriver } from "../IntegrationDriver.js";
import { IntegrationHub } from "../IntegrationHub.js";
import type { AppManifest, IntegrationPack } from "../IntegrationTypes.js";
import { CliConnector } from "../connectors/CliConnector.js";

const root = await mkdtemp(join(tmpdir(), "keynu-integration-hub-"));
const manifests = join(root, "manifests");
await import("node:fs/promises").then(({ mkdir }) => mkdir(manifests));

const calls: Array<{ action: EngineeringAction; payload: EngineeringPayload }> = [];
const fakeEngineering = {
  async execute(action: EngineeringAction, payload: EngineeringPayload): Promise<EngineeringOperationResult> {
    calls.push({ action, payload });
    return {
      action,
      projectRoot: payload.projectRoot,
      success: true,
      summary: "fixture execution",
      data: { ok: true },
    };
  },
};

const genericManifest: AppManifest = {
  schemaVersion: "keynu-app-manifest-0.1",
  id: "fixture-app",
  name: "Fixture App",
  connectors: [
    {
      id: "cli",
      kind: "cli",
      config: { command: "fixture-tool", defaultArgs: ["--base"] },
    },
  ],
  capabilities: [
    {
      name: "echo",
      description: "Prove an application can register without a custom Driver.",
      risk: "execute",
      connector: "cli",
      request: { args: ["--fixed"] },
    },
  ],
};

try {
  const appRegistry = new AppRegistry();
  appRegistry.register(genericManifest);
  assert.throws(() => appRegistry.register(genericManifest), /already registered/i);
  assert.throws(
    () =>
      appRegistry.register({
        ...genericManifest,
        id: "Invalid App Id",
      }),
    /must match/i,
  );

  const connectorRegistry = new ConnectorRegistry();
  connectorRegistry.register(new CliConnector(fakeEngineering));
  const hub = new IntegrationHub({ appRegistry, connectorRegistry });

  const generic = await hub.invoke("fixture-app", "echo", {
    projectRoot: root,
    args: ["dynamic"],
  });
  assert.equal(generic.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, "command.run");
  assert.equal(calls[0].payload.projectRoot, root);
  assert.deepEqual(calls[0].payload.command?.args, ["--base", "--fixed", "dynamic"]);
  assert.equal(calls[0].payload.command?.command, "fixture-tool");

  const semanticManifest: AppManifest = {
    schemaVersion: "keynu-app-manifest-0.1",
    id: "semantic-app",
    name: "Semantic App",
    capabilities: [
      { name: "inspect", description: "Domain-specific semantic operation.", risk: "read", handler: "pack" },
    ],
  };
  appRegistry.register(semanticManifest);
  let packInvocations = 0;
  const pack: IntegrationPack = {
    appId: "semantic-app",
    async invoke(capability, input, context) {
      packInvocations += 1;
      assert.equal(capability, "inspect");
      assert.equal(context.projectRoot, root);
      return { success: true, data: { input } };
    },
  };
  hub.registerPack(pack);
  const semantic = await hub.invoke("semantic-app", "inspect", { projectRoot: root, value: 7 });
  assert.equal(semantic.success, true);
  assert.equal(packInvocations, 1);

  await writeFile(join(manifests, "fixture-app.json"), JSON.stringify(genericManifest, null, 2), "utf8");
  const dynamicApps = new AppRegistry();
  const dynamicConnectors = new ConnectorRegistry();
  dynamicConnectors.register(new CliConnector(fakeEngineering));
  const dynamicHub = new IntegrationHub({ appRegistry: dynamicApps, connectorRegistry: dynamicConnectors });
  const capabilityRegistry = new CapabilityRegistry();
  const driver = new IntegrationDriver({
    hub: dynamicHub,
    capabilityRegistry,
    manifestDirectory: manifests,
  });
  await driver.initialize();

  const registered = capabilityRegistry.get("fixture-app.echo");
  assert.equal(registered?.driver, "integration");
  assert.equal(registered?.action, "app:fixture-app:echo");
  const listed = await driver.execute({ action: "listApps" });
  assert.equal(listed.success, true);
  assert.match(JSON.stringify(listed.data), /fixture-app/);
  const dynamic = await driver.execute({
    action: "app:fixture-app:echo",
    payload: { projectRoot: root, args: ["through-driver-bridge"] },
  });
  assert.equal(dynamic.success, true);

  console.log("IntegrationHub tests passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
