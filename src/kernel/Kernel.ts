import { EventBus } from './EventBus.js';
import { ServiceRegistry } from './ServiceRegistry.js';
import { KernelState } from './KernelState.js';
import type { KernelConfig } from './KernelConfig.js';

export class Kernel {
  readonly services = new ServiceRegistry();
  readonly events = new EventBus();

  private state: KernelState = 'booting';

  constructor(private readonly config: KernelConfig) {}

  async boot(): Promise<void> {
    await this.events.emit('kernel.boot');
    await this.services.startAll();
    this.state = 'running';
    await this.events.emit('kernel.ready');
    console.log(`[KAOS] Kernel ${this.config.version} started.`);
  }

  async shutdown(): Promise<void> {
    await this.events.emit('kernel.shutdown');
    await this.services.stopAll();
    this.state = 'stopped';
    console.log('[KAOS] Kernel stopped.');
  }

  getState(): KernelState {
    return this.state;
  }
}
