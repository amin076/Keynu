import { RuntimeScheduler } from '../runtime/RuntimeScheduler.js';

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
