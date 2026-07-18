import { CapabilityRegistry } from "../core/CapabilityRegistry.js";
import { CommandBus } from "../core/CommandBus.js";
import { DriverManager } from "../core/DriverManager.js";
import { Runtime } from "../core/Runtime.js";
import { registerBuiltinDrivers } from "../core/registerBuiltinDrivers.js";
import { ActiveMissionResolver, type ActiveMissionResolution } from "../mission/ActiveMissionResolver.js";
import { MissionManager } from "../mission/MissionManager.js";
import { SessionStore } from "../session/index.js";
import type { MissionBootstrapPayload } from "../mission/MissionTypes.js";
import { BrowserAgent } from "./BrowserAgent.js";
import { BrowserDriver } from "./BrowserDriver.js";
import { defaultBrowserConfig } from "./BrowserConfig.js";
import { printBrowserAgentStartupHelp } from "./BrowserAgentHelp.js";
import { createChatGptOnboardingMessage } from "./ChatGptOnboardingMessage.js";
import { decideMissionBootstrap, type MissionBootstrapDecision } from "./MissionBootstrapPolicy.js";

export type BrowserAgentAppConfig = {
  conversationUrl: string;
};

export type BrowserConversationTransport = {
  sendMessage(message: string): Promise<void>;
};

export type BrowserDriverLifecycle = {
  initialize(): Promise<void>;
  getConversation(): BrowserConversationTransport;
};

export type BrowserAgentLifecycle = {
  seedWatcherBaseline(): Promise<void>;
  start(): Promise<void>;
};

export type MissionBootstrapPreparer = {
  prepare(options?: {
    projectId?: string;
    conversationUrl?: string;
  }): MissionBootstrapPayload;
};

export type BrowserAgentAppDependencies = {
  sessionStore?: SessionStore;
  activeMissionResolver?: ActiveMissionResolver;
  missionManager?: MissionBootstrapPreparer;
  createRuntime?: () => Runtime | Promise<Runtime>;
  createBrowserDriver?: (conversationUrl: string) => BrowserDriverLifecycle;
  createBrowserAgent?: (
    browser: BrowserDriverLifecycle,
    runtime: Runtime,
  ) => BrowserAgentLifecycle;
  now?: () => Date;
};

export class BrowserAgentApp {
  constructor(
    private readonly config: BrowserAgentAppConfig,
    private readonly dependencies: BrowserAgentAppDependencies = {},
  ) {}

  async start(): Promise<void> {
    const sessionStore = this.dependencies.sessionStore ?? new SessionStore();
    const previousSession = sessionStore.read();
    const activeMissionResolver =
      this.dependencies.activeMissionResolver ?? new ActiveMissionResolver();
    const resolvedMission = activeMissionResolver.resolve();

    if (resolvedMission.action === "BLOCKED") {
      throw new Error(
        `Active mission could not be resolved: ${resolvedMission.diagnostics.join(" ")}`,
      );
    }

    const reconciliationPlan =
      activeMissionResolver.buildReconciliationPlan(resolvedMission);

    if (reconciliationPlan.shouldReconcileState) {
      activeMissionResolver.reconcile({
        projectId: resolvedMission.projectId,
      });
    }

    const bootstrapDecision = decideMissionBootstrap({
      session: previousSession,
      conversationUrl: this.config.conversationUrl,
      resolution: resolvedMission,
      nowMs: this.now().getTime(),
    });
    const {
      isSameConversation,
      bootstrapPending,
      shouldRestoreMission,
    } = bootstrapDecision;

    sessionStore.patch({
      conversationUrl: this.config.conversationUrl,
      memoryRestored: isSameConversation
        ? previousSession.memoryRestored && !shouldRestoreMission
        : false,
      missionRestorationStaleReason: shouldRestoreMission
        ? bootstrapDecision.reason
        : previousSession.missionRestorationStaleReason,
      runtimeState: "starting",
    });

    const runtime = await this.createRuntime();

    const browser =
      this.dependencies.createBrowserDriver?.(this.config.conversationUrl) ??
      new BrowserDriver({
        ...defaultBrowserConfig,
        dedicatedConversationUrl: this.config.conversationUrl,
      });

    await browser.initialize();

    const agent =
      this.dependencies.createBrowserAgent?.(browser, runtime) ??
      new BrowserAgent(browser as BrowserDriver, runtime);

    printBrowserAgentStartupHelp(this.config.conversationUrl);

    await agent.seedWatcherBaseline();

    if (shouldRestoreMission) {
      await this.sendMissionBootstrap(
        browser,
        sessionStore,
        this.dependencies.missionManager ?? new MissionManager(),
        resolvedMission,
        bootstrapDecision,
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
    browser: BrowserDriverLifecycle,
    sessionStore: SessionStore,
    missionManager: MissionBootstrapPreparer,
    resolvedMission: ActiveMissionResolution,
    bootstrapDecision: MissionBootstrapDecision,
  ): Promise<void> {
    const conversation = browser.getConversation();

    try {
      console.log(
        "[agent] Preparing mission bootstrap for ChatGPT...",
      );

      const bootstrap = missionManager.prepare({
        projectId: resolvedMission.projectId,
        conversationUrl: this.config.conversationUrl,
      });
      this.assertBootstrapMatchesResolution(bootstrap, resolvedMission);
      const message = `\`\`\`kap\n${JSON.stringify(bootstrap, null, 2)}\n\`\`\``;

      await conversation.sendMessage(message);

      sessionStore.patch({
        memoryRestored: false,
        missionProjectId: bootstrap.payload.projectId,
        missionId: bootstrap.payload.missionId,
        missionBootstrapId: bootstrap.payload.bootstrapId,
        missionMemoryRevision: bootstrap.payload.memoryRevision,
        missionBootstrapSentAt: this.now().toISOString(),
        missionBootstrapConversationUrl: this.config.conversationUrl,
        missionAcknowledgedAt: undefined,
        missionRestorationStaleReason: bootstrapDecision.reason,
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

  private assertBootstrapMatchesResolution(
    bootstrap: MissionBootstrapPayload,
    resolvedMission: ActiveMissionResolution,
  ): void {
    if (
      bootstrap.payload.projectId !== resolvedMission.projectId ||
      bootstrap.payload.missionId !== resolvedMission.missionId
    ) {
      throw new Error(
        `Mission bootstrap '${bootstrap.payload.projectId}/${bootstrap.payload.missionId}' does not match resolved mission '${resolvedMission.projectId}/${resolvedMission.missionId}'.`,
      );
    }
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private async createRuntime(): Promise<Runtime> {
    if (this.dependencies.createRuntime) {
      return await this.dependencies.createRuntime();
    }

    const driverManager = new DriverManager();
    const capabilityRegistry = new CapabilityRegistry();

    await registerBuiltinDrivers(driverManager, capabilityRegistry);

    const commandBus = new CommandBus(
      driverManager,
      capabilityRegistry,
    );

    return new Runtime(commandBus);
  }
}
