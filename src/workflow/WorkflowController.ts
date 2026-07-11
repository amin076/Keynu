import { EventBus } from '../kernel/EventBus.js';
import { WorkflowEngine } from './WorkflowEngine.js';
import { WorkflowStore } from './WorkflowStore.js';
import { WorkflowContinuationService } from './WorkflowContinuationService.js';
import { WorkflowJobGenerator } from './WorkflowJobGenerator.js';
import { RuntimeEvents } from '../runtime/RuntimeEvents.js';

export class WorkflowController {
  private readonly engine: WorkflowEngine;
  private readonly continuation: WorkflowContinuationService;

  constructor(
    private readonly events: EventBus,
    private readonly store: WorkflowStore,
    private readonly generator: WorkflowJobGenerator,
  ) {
    this.engine = new WorkflowEngine();
    this.continuation = new WorkflowContinuationService(
      this.store,
      this.generator,
    );
  }

  start(): void {
    this.events.on(RuntimeEvents.REPORT_CREATED, async (payload: any) => {
      await this.continuation.check(
        payload.workflowId,
        payload,
      );
    });
  }
}
