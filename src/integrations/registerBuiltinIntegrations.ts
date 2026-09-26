import { CliConnector } from "./connectors/CliConnector.js";
import { FileConnector } from "./connectors/FileConnector.js";
import { HttpConnector } from "./connectors/HttpConnector.js";
import { McpConnector } from "./connectors/McpConnector.js";
import { IntegrationHub } from "./IntegrationHub.js";
import { MelakatIntegrationPack } from "./packs/melakat/MelakatIntegrationPack.js";

export function createBuiltinIntegrationHub(): IntegrationHub {
  const hub = new IntegrationHub();
  hub.connectors.register(new CliConnector());
  hub.connectors.register(new FileConnector());
  hub.connectors.register(new HttpConnector());
  hub.connectors.register(new McpConnector());
  hub.registerPack(new MelakatIntegrationPack());
  return hub;
}
