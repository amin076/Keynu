import { EventBus } from '../kernel/EventBus.js';
import { SchedulerEvents } from './SchedulerEvents.js';

export type RuntimeJobState =
  | 'NEW'
  | 'QUEUED'
  | 'READY'
  | 'RUNNING'
  | 'WAITING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface RuntimeJob {
  id: string;
  priority: number;
  state: RuntimeJobState;
  createdAt: string;
  dependsOn?: string[];
  payload?: unknown;
}

export class RuntimeScheduler {
  private readonly queue: RuntimeJob[] = [];

  constructor(private readonly events: EventBus) {}

  async enqueue(job: RuntimeJob): Promise<void> {
    job.state = 'QUEUED';
    this.queue.push(job);
    this.queue.sort((a,b)=>b.priority-a.priority);

    await this.events.emit(SchedulerEvents.JOB_QUEUED, job);
    await this.events.emit(SchedulerEvents.QUEUE_CHANGED, this.queue);
  }

  next(): RuntimeJob | undefined {
    return this.queue.shift();
  }

  size(): number {
    return this.queue.length;
  }
}
