import { WorkflowStore } from './WorkflowStore.js';
import { WorkflowJobGenerator } from './WorkflowJobGenerator.js';

export class WorkflowContinuationService {
  constructor(
    private readonly store: WorkflowStore,
    private readonly generator: WorkflowJobGenerator,
  ) {}

  async check(workflowId: string, report: any): Promise<void> {
    await this.continue(workflowId, report);
  }

  async continue(workflowId: string, report: any): Promise<void> {
    const workflow = await this.store.get(workflowId);

    if (!workflow) {
      return;
    }

    if (report?.payload?.status !== 'COMPLETED') {
      return;
    }

    const nextStep = workflow.nextStep;

    if (!nextStep) {
      return;
    }

    await this.generator.generate(workflowId, nextStep);
  }
}
