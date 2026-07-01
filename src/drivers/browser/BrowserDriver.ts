import type { Driver } from "../../core/Driver.js";

type BrowserCommand = {
  action: string;
  payload?: unknown;
};

export class BrowserDriver implements Driver {
  readonly id = "browser";

  async initialize(): Promise<void> {
    console.log("Browser Driver Ready (foundation only)");
  }

  async execute(command: unknown): Promise<void> {
    const browserCommand = command as BrowserCommand;

    throw new Error(
      `Browser action '${browserCommand.action}' is not implemented yet. ` +
        "This driver is intentionally a Phase 1 foundation stub.",
    );
  }
}
