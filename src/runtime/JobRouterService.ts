import { RuntimeScheduler } from './RuntimeScheduler.js';
import { JobStateService } from '../services/JobStateService.js';

export class JobRouterService {
  constructor(
    private readonly scheduler: RuntimeScheduler,
    private readonly state: JobStateService,
  ) {}

  async route(kap: any): Promise<void> {
    const existing = await this.state.get(kap.id);

    if (existing?.state === 'COMPLETED') {
      return;
    }

    await this.state.start(kap.id);

    await this.scheduler.enqueue({
      id: kap.id,
      priority: 100,
      state: 'NEW',
      createdAt: new Date().toISOString(),
      payload: kap,
    });
  }
}
