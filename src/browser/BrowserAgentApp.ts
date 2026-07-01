import { CapabilityRegistry } from "../core/CapabilityRegistry.js";
import { CommandBus } from "../core/CommandBus.js";
import { DriverManager } from "../core/DriverManager.js";
import { Runtime } from "../core/Runtime.js";
import { registerBuiltinDrivers } from "../core/registerBuiltinDrivers.js";
import { BrowserAgent } from "./BrowserAgent.js";
import { BrowserDriver } from "./BrowserDriver.js";
import { defaultBrowserConfig } from "./BrowserConfig.js";

export type BrowserAgentAppConfig = {
  conversationUrl: string;
};

export class BrowserAgentApp {
  constructor(private readonly config: BrowserAgentAppConfig) {}

  async start(): Promise<void> {
    const driverManager = new DriverManager();
    const capabilityRegistry = new CapabilityRegistry();

    await registerBuiltinDrivers(driverManager, capabilityRegistry);

    const commandBus = new CommandBus(driverManager, capabilityRegistry);
    const runtime = new Runtime(commandBus);

    const browser = new BrowserDriver({
      ...defaultBrowserConfig,
      dedicatedConversationUrl: this.config.conversationUrl,
    });

    await browser.initialize();

    const agent = new BrowserAgent(browser, runtime);

    console.log("");
    console.log("======================");
    console.log("Keynu Browser Agent");
    console.log("======================");
    console.log("");
    console.log("Watching dedicated conversation...");
    console.log("");

    await agent.start();
  }
}
