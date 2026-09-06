import { EngineeringRuntime } from "../../engineering/EngineeringRuntime.js";
import type { MelakatEngineeringRuntime } from "../../drivers/melakat/MelakatTypes.js";
import type {
  AppConnectorManifest,
  IntegrationConnector,
  IntegrationInvocationContext,
} from "../IntegrationTypes.js";

const FILE_ACTIONS = {
  readFile: "fs.readFile",
  writeFile: "fs.writeFile",
  listDirectory: "fs.listDirectory",
  exists: "fs.exists",
  createFolder: "fs.createFolder",
} as const;

export class FileConnector implements IntegrationConnector {
  readonly kind = "file" as const;

  constructor(private readonly engineeringRuntime: MelakatEngineeringRuntime = new EngineeringRuntime()) {}

  async invoke(connector: AppConnectorManifest, context: IntegrationInvocationContext) {
    const request = context.capability.request ?? {};
    const operation = request.action;
    if (typeof operation !== "string" || !(operation in FILE_ACTIONS)) {
      throw new Error(`File capability '${context.capability.name}' must declare a supported request.action.`);
    }
    const path = typeof context.input.path === "string" ? context.input.path : request.path;
    if (typeof path !== "string" || !path.trim()) {
      throw new Error(`File capability '${context.capability.name}' requires a path.`);
    }
    const engineeringAction = FILE_ACTIONS[operation as keyof typeof FILE_ACTIONS];
    const execution = await this.engineeringRuntime.execute(engineeringAction, {
      projectRoot: context.projectRoot,
      path,
      content:
        typeof context.input.content === "string"
          ? context.input.content
          : typeof request.content === "string"
            ? request.content
            : undefined,
    });

    return {
      success: execution.success,
      message: execution.success
        ? `${context.app.name} capability '${context.capability.name}' completed through file connector.`
        : `${context.app.name} capability '${context.capability.name}' failed through file connector.`,
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
