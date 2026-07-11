import type { Service } from '../kernel/Service.js';

export class DashboardService implements Service {
  readonly id = 'dashboard';

  async start(): Promise<void> {
    console.log('[DashboardService] started');
  }

  async stop(): Promise<void> {
    console.log('[DashboardService] stopped');
  }
}
