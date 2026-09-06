import { MelakatDriver } from "../../../drivers/melakat/MelakatDriver.js";
import type { MelakatAction, MelakatPayload } from "../../../drivers/melakat/MelakatTypes.js";
import type {
  IntegrationInvocationContext,
  IntegrationPack,
} from "../../IntegrationTypes.js";

export class MelakatIntegrationPack implements IntegrationPack {
  readonly appId = "melakat";

  constructor(private readonly compatibilityImplementation = new MelakatDriver()) {}

  async invoke(
    capability: string,
    input: Record<string, unknown>,
    context: IntegrationInvocationContext,
  ) {
    return await this.compatibilityImplementation.execute({
      action: capability as MelakatAction,
      payload: {
        ...(input as MelakatPayload),
        projectRoot: context.projectRoot,
      },
    });
  }
}
