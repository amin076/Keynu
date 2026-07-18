import type { KapEnvelope } from '../kap/KapEnvelope.js';
import type { ExecutionContext } from './ExecutionContext.js';
import type {
  RuntimeDispatchAction,
  RuntimeDispatchItem,
} from './RuntimeResult.js';

export type RuntimeDispatchHandler = (
  envelope: KapEnvelope,
  context: ExecutionContext,
) => Promise<RuntimeDispatchItem> | RuntimeDispatchItem;

export type RuntimeDispatcherOptions = {
  handlers?: Partial<Record<string, RuntimeDispatchHandler>>;
};

function actionForType(type: string): RuntimeDispatchAction {
  if (type === 'JOB' || type === 'REPORT' || type === 'ERROR') return type;
  return 'UNHANDLED';
}

export class RuntimeDispatcher {
  private readonly handlers = new Map<string, RuntimeDispatchHandler>();

  constructor(options: RuntimeDispatcherOptions = {}) {
    for (const [type, handler] of Object.entries(options.handlers ?? {})) {
      if (handler) this.handlers.set(type, handler);
    }
  }

  register(type: string, handler: RuntimeDispatchHandler): void {
    this.handlers.set(type, handler);
  }

  async dispatch(
    envelope: KapEnvelope,
    context: ExecutionContext = {},
  ): Promise<RuntimeDispatchItem> {
    const customHandler = this.handlers.get(envelope.type);
    if (customHandler) return await customHandler(envelope, context);

    const action = actionForType(envelope.type);

    return {
      status: action === 'UNHANDLED' ? 'SKIPPED' : 'COMPLETED',
      action,
      envelope,
      message: action === 'UNHANDLED'
        ? `No runtime dispatcher is registered for KAP type '${envelope.type}'.`
        : `KAP ${envelope.type} accepted by ProviderRuntime.`,
      metadata: {
        providerId: context.providerId,
        requestId: context.requestId,
        responseId: context.responseId,
      },
    };
  }
}
