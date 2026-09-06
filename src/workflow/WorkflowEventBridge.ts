import { EventBus } from '../kernel/EventBus.js';
import { RuntimeEvents } from '../runtime/RuntimeEvents.js';
import { WorkflowContinuationService } from './WorkflowContinuationService.js';

/**
 * @deprecated Legacy workflow compatibility only.
 *
 * This bridge installs a REPORT_CREATED continuation listener. It is retained
 * only inside the quarantined workflow subsystem and must not be wired beside
 * BrowserContinuationCoordinator in the active runtime.
 */
export class WorkflowEventBridge {
  constructor(
    private readonly events: EventBus,
    private readonly continuation: WorkflowContinuationService,
  ) {}

  start(): void {
    this.events.on(RuntimeEvents.REPORT_CREATED, async (payload:any) => {
      if (!payload?.workflowId) return;

      await this.continuation.check(
        payload.workflowId,
        payload,
      );
    });
  }
}
