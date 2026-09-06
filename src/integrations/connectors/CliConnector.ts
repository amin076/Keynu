import { EngineeringRuntime } from "../../engineering/EngineeringRuntime.js";
import type { MelakatEngineeringRuntime } from "../../drivers/melakat/MelakatTypes.js";
import type {
  AppConnectorManifest,
  IntegrationConnector,
  IntegrationInvocationContext,
} from "../IntegrationTypes.js";

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function stringArray(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label} must be an array of strings.`);
  }
  return [...value] as string[];
}

export class CliConnector implements IntegrationConnector {
  readonly kind = "cli" as const;

  constructor(private readonly engineeringRuntime: MelakatEngineeringRuntime = new EngineeringRuntime()) {}

  async invoke(connector: AppConnectorManifest, context: IntegrationInvocationContext) {
    const config = connector.config ?? {};
    const command = requireString(config.command, `CLI connector '${connector.id}' command`);
    const staticArgs = [
      ...stringArray(config.defaultArgs, `CLI connector '${connector.id}' defaultArgs`),
      ...stringArray(context.capability.request?.args, `Capability '${context.capability.name}' request.args`),
    ];
    const inputArgs = stringArray(context.input.args, `Capability '${context.capability.name}' input.args`);
    const timeoutMs =
      typeof context.input.timeoutMs === "number"
        ? context.input.timeoutMs
        : typeof context.capability.request?.timeoutMs === "number"
          ? context.capability.request.timeoutMs
          : typeof config.timeoutMs === "number"
            ? config.timeoutMs
            : 120_000;

    const execution = await this.engineeringRuntime.execute("command.run", {
      projectRoot: context.projectRoot,
      command: {
        command,
        args: [...staticArgs, ...inputArgs],
        cwd: typeof config.cwd === "string" ? config.cwd : context.projectRoot,
        timeoutMs,
      },
    });

    return {
      success: execution.success,
      message: execution.success
        ? `${context.app.name} capability '${context.capability.name}' completed through CLI connector.`
        : `${context.app.name} capability '${context.capability.name}' failed through CLI connector.`,
      data: {
        appId: context.app.id,
        capability: context.capability.name,
        connector: connector.id,
        connectorKind: this.kind,
        execution,
      },
    };
  }
}
