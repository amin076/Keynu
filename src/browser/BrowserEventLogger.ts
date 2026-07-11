import { browserEventBus } from './BrowserEventBus.js';
import { BrowserEvents } from './BrowserEvents.js';

export class BrowserEventLogger {
  start(): void {
    for (const event of Object.values(BrowserEvents)) {
      browserEventBus.on(event, async (payload) => {
        console.log(
          '[BrowserEvent]',
          event,
          this.summarize(payload),
        );
      });
    }
  }

  private summarize(payload: any): any {
    if (!payload) return payload;

    if (payload.message?.text) {
      return {
        message: {
          id: payload.message.id,
          length: typeof payload.message.text === 'string' ? payload.message.text.length : 0,
        },
        occurredAt: payload.occurredAt,
      };
    }

    return payload;
  }
}