import type { Service } from '../kernel/Service.js';
import type { Runtime } from '../core/Runtime.js';

export class RuntimeService implements Service {
  readonly id = 'runtime';

  constructor(private readonly runtime: Runtime) {}

  async start(): Promise<void> {
    console.log('[RuntimeService] started');
  }

  async stop(): Promise<void> {
    console.log('[RuntimeService] stopped');
  }

  getRuntime(): Runtime {
    return this.runtime;
  }
}
