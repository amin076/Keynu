import type { ConnectorKind, IntegrationConnector } from "./IntegrationTypes.js";

export class ConnectorRegistry {
  private readonly connectors = new Map<ConnectorKind, IntegrationConnector>();

  register(connector: IntegrationConnector): void {
    if (this.connectors.has(connector.kind)) {
      throw new Error(`Connector kind '${connector.kind}' is already registered.`);
    }
    this.connectors.set(connector.kind, connector);
  }

  get(kind: ConnectorKind): IntegrationConnector | undefined {
    return this.connectors.get(kind);
  }

  list(): ConnectorKind[] {
    return [...this.connectors.keys()].sort();
  }
}
