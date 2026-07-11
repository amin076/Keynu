import { EventBus } from '../kernel/EventBus.js';
import { RuntimeScheduler } from './RuntimeScheduler.js';
import { RuntimeEvents } from './RuntimeEvents.js';

export class RuntimeOrchestrator {
  constructor(
    private readonly events: EventBus,
    private readonly scheduler: RuntimeScheduler,
  ) {}

  async start(): Promise<void> {
    await this.events.emit('orchestrator.started');

    this.events.on(RuntimeEvents.KAP_PARSED, async (payload: any) => {
      await this.events.emit('orchestrator.job.received', payload);
    });

    this.events.on(RuntimeEvents.JOB_STARTED, async (payload: any) => {
      await this.events.emit('orchestrator.driver.select', payload);
    });

    this.events.on(RuntimeEvents.DRIVER_COMPLETED, async (payload: any) => {
      await this.events.emit('orchestrator.report.route', payload);
    });
  }
}
