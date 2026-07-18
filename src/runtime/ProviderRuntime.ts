import type { ProviderResponse } from '../providers/api/ProviderResponse.js';
import type { ExecutionContext } from './ExecutionContext.js';
import { KapInterpreter } from './KapInterpreter.js';
import { KapValidator } from './KapValidator.js';
import { ResponseInterpreter } from './ResponseInterpreter.js';
import { RuntimeDispatcher } from './RuntimeDispatcher.js';
import type { RuntimeEvent } from './RuntimeEvent.js';
import type { RuntimeResult } from './RuntimeResult.js';

export type ProviderRuntimeOptions = {
  responseInterpreter?: ResponseInterpreter;
  kapInterpreter?: KapInterpreter;
  kapValidator?: KapValidator;
  runtimeDispatcher?: RuntimeDispatcher;
};

export class ProviderRuntime {
  private readonly responseInterpreter: ResponseInterpreter;
  private readonly kapInterpreter: KapInterpreter;
  private readonly kapValidator: KapValidator;
  private readonly runtimeDispatcher: RuntimeDispatcher;

  constructor(options: ProviderRuntimeOptions = {}) {
    this.responseInterpreter =
      options.responseInterpreter ?? new ResponseInterpreter();
    this.kapInterpreter = options.kapInterpreter ?? new KapInterpreter();
    this.kapValidator = options.kapValidator ?? new KapValidator();
    this.runtimeDispatcher =
      options.runtimeDispatcher ?? new RuntimeDispatcher();
  }

  async execute(
    response: ProviderResponse,
    context: ExecutionContext = {},
  ): Promise<RuntimeResult> {
    const executionContext: ExecutionContext = {
      ...context,
      providerId: context.providerId ?? response.providerId,
      requestId: context.requestId ?? response.requestId,
      responseId: context.responseId ?? response.id,
      providerResponse: response,
    };
    const interpreted = this.responseInterpreter.interpret(response);
    const events: RuntimeEvent[] = [{
      type: 'response.interpreted',
      message: 'Provider response interpreted.',
      metadata: interpreted.metadata,
    }];
    const kap = this.kapInterpreter.interpret(interpreted.text);
    const errors = [...kap.errors];

    if (kap.blocks.length === 0) {
      events.push({
        type: 'runtime.completed',
        message: 'Provider response contained no KAP blocks.',
      });

      return {
        status: 'SKIPPED',
        providerResponse: response,
        text: interpreted.text,
        items: [],
        events,
        errors,
      };
    }

    events.push({
      type: 'kap.detected',
      message: `${kap.blocks.length} KAP block(s) detected.`,
      metadata: {
        count: kap.blocks.length,
      },
    });

    const items = [];

    for (const validation of this.kapValidator.validateAll(kap.blocks)) {
      if (!validation.valid) {
        const message = validation.errors
          .map((error) => `${error.field}: ${error.message}`)
          .join('; ');
        errors.push(message);
        events.push({
          type: 'kap.invalid',
          message,
          blockId: validation.block.id,
        });
        continue;
      }

      events.push({
        type: 'kap.validated',
        message: `KAP envelope validated: ${validation.value.envelope.type}.`,
        envelope: validation.value.envelope,
        blockId: validation.value.block.id,
      });

      const dispatched = await this.runtimeDispatcher.dispatch(
        validation.value.envelope,
        executionContext,
      );
      dispatched.blockId = validation.value.block.id;
      items.push(dispatched);
      events.push({
        type: dispatched.status === 'SKIPPED'
          ? 'dispatch.skipped'
          : 'dispatch.completed',
        message: dispatched.message ?? `KAP ${dispatched.action} dispatched.`,
        envelope: dispatched.envelope,
        blockId: dispatched.blockId,
        metadata: dispatched.metadata,
      });
    }

    const status = errors.length > 0
      ? items.length > 0
        ? 'PARTIAL'
        : 'FAILED'
      : items.length > 0
        ? 'COMPLETED'
        : 'FAILED';

    events.push({
      type: status === 'FAILED' ? 'runtime.failed' : 'runtime.completed',
      message: `Provider runtime finished with status ${status}.`,
      metadata: {
        itemCount: items.length,
        errorCount: errors.length,
      },
    });

    return {
      status,
      providerResponse: response,
      text: interpreted.text,
      items,
      events,
      errors,
    };
  }
}
