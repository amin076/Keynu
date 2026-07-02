import type { AgentCommand } from "../../core/CommandBus.js";

export interface LegacyDriver {
  readonly name: string;

  initialize?(): Promise<void>;

  shutdown?(): Promise<void>;

  execute(command: AgentCommand): Promise<void>;
}
