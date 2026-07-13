import { CapabilityRegistry } from "../core/CapabilityRegistry.js";
import { CommandBus } from "../core/CommandBus.js";
import { DriverManager } from "../core/DriverManager.js";
import { Runtime } from "../core/Runtime.js";
import { registerBuiltinDrivers } from "../core/registerBuiltinDrivers.js";
import { MissionManager } from "../mission/MissionManager.js";
import { SessionStore } from "../session/index.js";
import { BrowserAgent } from "./BrowserAgent.js";
import { BrowserDriver } from "./BrowserDriver.js";
import { defaultBrowserConfig } from "./BrowserConfig.js";
import { printBrowserAgentStartupHelp } from "./BrowserAgentHelp.js";
import { createChatGptOnboardingMessage } from "./ChatGptOnboardingMessage.js";

export type BrowserAgentAppConfig = {
  conversationUrl: string;
};

export class BrowserAgentApp {
  constructor(private readonly config: BrowserAgentAppConfig) {}

  async start(): Promise<void> {
    const sessionStore = new SessionStore();
    const previousSession = sessionStore.read();
    const isSameConversation =
      previousSession.conversationUrl === this.config.conversationUrl;
    const bootstrapAgeMs = previousSession.missionBootstrapSentAt
      ? Date.now() - Date.parse(previousSession.missionBootstrapSentAt)
      : Number.POSITIVE_INFINITY;
    const bootstrapPending =
      isSameConversation &&
      !previousSession.memoryRestored &&
      previousSession.missionBootstrapConversationUrl === this.config.conversationUrl &&
      bootstrapAgeMs < 5 * 60 * 1000;
    const shouldRestoreMission =
      !isSameConversation || (!previousSession.memoryRestored && !bootstrapPending);

    sessionStore.patch({
      conversationUrl: this.config.conversationUrl,
      memoryRestored: isSameConversation
        ? previousSession.memoryRestored
        : false,
      runtimeState: "starting",
    });

    const driverManager = new DriverManager();
    const capabilityRegistry = new CapabilityRegistry();

    await registerBuiltinDrivers(driverManager, capabilityRegistry);

    const commandBus = new CommandBus(
      driverManager,
      capabilityRegistry,
    );
    const runtime = new Runtime(commandBus);

    const browser = new BrowserDriver({
      ...defaultBrowserConfig,
      dedicatedConversationUrl: this.config.conversationUrl,
    });

    await browser.initialize();

    const agent = new BrowserAgent(browser, runtime);

    printBrowserAgentStartupHelp(this.config.conversationUrl);

    if (shouldRestoreMission) {
      await this.sendMissionBootstrap(
        browser,
        sessionStore,
      );
    } else {
      console.log(
        bootstrapPending
          ? "[agent] Mission bootstrap already sent; waiting for acknowledgement."
          : "[agent] Mission already restored for this conversation. Skipping bootstrap.",
      );
    }

    sessionStore.patch({ runtimeState: "idle" });

    await agent.start();
  }

  private async sendMissionBootstrap(
    browser: BrowserDriver,
    sessionStore: SessionStore,
  ): Promise<void> {
    const conversation = browser.getConversation();
    const missionManager = new MissionManager();

    try {
      console.log(
        "[agent] Preparing mission bootstrap for ChatGPT...",
      );

      const message = missionManager.prepareMessage({
        conversationUrl: this.config.conversationUrl,
      });

      await conversation.sendMessage(message);

      sessionStore.patch({
        memoryRestored: false,
        missionBootstrapSentAt: new Date().toISOString(),
        missionBootstrapConversationUrl: this.config.conversationUrl,
        missionAcknowledgedAt: undefined,
        runtimeState: "idle",
      });

      console.log("[agent] Mission bootstrap sent.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(
        `[agent] Mission bootstrap failed: ${errorMessage}`,
      );

      console.log(
        "[agent] Sending legacy onboarding message as fallback...",
      );

      await conversation.sendMessage(
        createChatGptOnboardingMessage(),
      );

      sessionStore.patch({
        memoryRestored: false,
        runtimeState: "idle",
      });

      console.log("[agent] Legacy onboarding message sent.");
    }
  }
}
