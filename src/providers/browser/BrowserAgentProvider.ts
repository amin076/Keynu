import { BrowserAgentApp } from '../../browser/BrowserAgentApp.js';
import type { AIProvider, AIProviderStartOptions } from '../AIProvider.js';
import type { ProviderCapabilities } from '../ProviderCapabilities.js';
import { createProviderResult, type ProviderResult } from '../ProviderResult.js';
import type { ProviderSession } from '../ProviderSession.js';

export type BrowserAgentProviderApp = {
  start(): Promise<void>;
};

export type BrowserAgentProviderOptions = {
  createApp?: (conversationUrl: string) => BrowserAgentProviderApp;
  now?: () => Date;
};

export class BrowserAgentProvider implements AIProvider {
  readonly id = 'browser-agent-chatgpt';
  readonly name = 'BrowserAgent ChatGPT';
  readonly capabilities: ProviderCapabilities = {
    transport: 'browser',
    capabilities: [
      'mission.bootstrap',
      'kap.receive',
      'kap.send',
      'conversation.watch',
      'continuation.request',
    ],
    supportsMissionBootstrap: true,
    supportsKap: true,
    supportsContinuation: true,
    supportsInteractiveSession: true,
  };

  constructor(private readonly options: BrowserAgentProviderOptions = {}) {}

  createSession(input: Partial<ProviderSession> = {}): ProviderSession {
    return {
      id: input.id ?? `browser-agent-${Date.now()}`,
      providerId: this.id,
      status: input.status ?? 'created',
      missionProjectId: input.missionProjectId,
      missionId: input.missionId,
      conversationUrl: input.conversationUrl,
      startedAt: input.startedAt,
      stoppedAt: input.stoppedAt,
      metadata: input.metadata,
    };
  }

  async start(options: AIProviderStartOptions): Promise<ProviderResult> {
    const { session, task } = options;

    if (!session.conversationUrl) {
      return createProviderResult(
        this.id,
        task ?? { id: `start-${session.id}`, type: 'start-session' },
        'failed',
        {
          session: {
            ...session,
            status: 'failed',
          },
          error: 'BrowserAgent provider requires session.conversationUrl.',
        },
      );
    }

    const startedSession: ProviderSession = {
      ...session,
      providerId: this.id,
      status: 'active',
      startedAt: session.startedAt ?? this.now().toISOString(),
    };

    const app = this.createApp(session.conversationUrl);
    await app.start();

    return createProviderResult(
      this.id,
      task ?? { id: `start-${session.id}`, type: 'start-session' },
      'accepted',
      {
        session: startedSession,
      },
    );
  }

  private createApp(conversationUrl: string): BrowserAgentProviderApp {
    return this.options.createApp?.(conversationUrl) ??
      new BrowserAgentApp({ conversationUrl });
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }
}
