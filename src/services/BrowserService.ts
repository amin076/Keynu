import type { Service } from '../kernel/Service.js';

export class BrowserService implements Service {
  readonly id = 'browser';

  async start(): Promise<void> {
    console.log('[BrowserService] started');
  }

  async stop(): Promise<void> {
    console.log('[BrowserService] stopped');
  }
}
