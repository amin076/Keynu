import { RuntimeScheduler } from '../runtime/RuntimeScheduler.js';

/**
 * @deprecated Legacy workflow compatibility only.
 *
 * Jobs generated here enter RuntimeScheduler's in-memory queue and are not
 * restart-safe. New durable continuation work must use the canonical mission
 * continuation runtime.
 */
export class WorkflowJobGenerator {
  constructor(
    private readonly scheduler: RuntimeScheduler,
  ) {}

  async generate(workflowId: string, step: any): Promise<void> {
    if (!step) return;

    await this.scheduler.enqueue({
      id: `workflow-${workflowId}-${step.id}`,
      priority: 100,
      state: 'NEW',
      createdAt: new Date().toISOString(),
      payload: {
        workflowId,
        step,
      },
    });
  }
}
