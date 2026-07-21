export const DEFAULT_REMINDER_INTERVAL_MS = 4 * 60 * 1000;
export const DEFAULT_MAX_REMINDERS = 3;

export type BrowserContinuationReminderSender = (
  message: string,
) => Promise<void>;

export type BrowserContinuationReminderServiceOptions = {
  reminderIntervalMs?: number;
  maxReminders?: number;
};

export class BrowserContinuationReminderService {
  private readonly reminderIntervalMs: number;
  private readonly maxReminders: number;

  private timer: ReturnType<typeof setTimeout> | undefined;
  private reminderCount = 0;
  private generation = 0;
  private active = false;

  constructor(
    private readonly sendMessage: BrowserContinuationReminderSender,
    options: BrowserContinuationReminderServiceOptions = {},
  ) {
    this.reminderIntervalMs =
      options.reminderIntervalMs ?? DEFAULT_REMINDER_INTERVAL_MS;

    this.maxReminders =
      options.maxReminders ?? DEFAULT_MAX_REMINDERS;

    if (
      !Number.isFinite(this.reminderIntervalMs) ||
      this.reminderIntervalMs <= 0
    ) {
      throw new Error(
        "BrowserContinuationReminderService reminderIntervalMs must be greater than zero.",
      );
    }

    if (
      !Number.isInteger(this.maxReminders) ||
      this.maxReminders < 0
    ) {
      throw new Error(
        "BrowserContinuationReminderService maxReminders must be a non-negative integer.",
      );
    }
  }

  /**
   * Starts a new reminder chain.
   *
   * Any previously active chain is cancelled first. This guarantees that
   * only one timer and one reminder chain can be active at a time.
   */
  start(): void {
    this.cancel();

    this.active = true;
    this.reminderCount = 0;

    const chainGeneration = ++this.generation;

    console.log(
      `[continuation-reminder] Reminder chain started. ` +
        `intervalMs=${this.reminderIntervalMs}, ` +
        `maxReminders=${this.maxReminders}`,
    );

    this.scheduleNext(chainGeneration);
  }

  /**
   * Cancels the active reminder chain immediately.
   *
   * This method is safe to call when no chain is active.
   */
  cancel(): void {
    const wasActive = this.active;

    this.stopTimer();
    this.active = false;
    this.reminderCount = 0;

    /*
     * Incrementing the generation invalidates callbacks or asynchronous sends
     * that may already have begun under an older reminder chain.
     */
    this.generation += 1;

    if (wasActive) {
      console.log(
        '[continuation-reminder] Reminder chain cancelled.',
      );
    }
  }

  private stopTimer(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Indicates whether a reminder chain is currently active.
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Returns the number of reminders successfully attempted by the current
   * active chain.
   */
  getReminderCount(): number {
    return this.reminderCount;
  }

  private scheduleNext(chainGeneration: number): void {
    if (!this.isCurrentChain(chainGeneration)) {
      return;
    }

    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    this.timer = setTimeout(() => {
      this.timer = undefined;

      void this.handleTimer(chainGeneration);
    }, this.reminderIntervalMs);
  }

  private async handleTimer(
    chainGeneration: number,
  ): Promise<void> {
    if (!this.isCurrentChain(chainGeneration)) {
      return;
    }

    if (this.reminderCount < this.maxReminders) {
      const reminderNumber = this.reminderCount + 1;

      try {
        await this.sendMessage(
          this.createReminderMessage(reminderNumber),
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.error(
          `[continuation-reminder] Reminder #${reminderNumber} ` +
            `could not be sent: ${errorMessage}`,
        );
      }

      /*
       * The assistant may have responded while the asynchronous send was in
       * progress. In that case BrowserAgent has already called cancel(), so
       * this callback must not update or restart the old chain.
       */
      if (!this.isCurrentChain(chainGeneration)) {
        return;
      }

      this.reminderCount = reminderNumber;

      console.log(
        `[continuation-reminder] Reminder #${reminderNumber} processed.`,
      );

      this.scheduleNext(chainGeneration);
      return;
    }

    await this.sendStoppedMessage(chainGeneration);
  }

  private async sendStoppedMessage(
    chainGeneration: number,
  ): Promise<void> {
    if (!this.isCurrentChain(chainGeneration)) {
      return;
    }

    /*
     * Mark the chain inactive before awaiting delivery. No new timer will be
     * scheduled after the final message, even if delivery fails.
     */
    this.active = false;
    this.timer = undefined;

    try {
      await this.sendMessage(
        "KEYNU_CONTINUATION_REMINDERS_STOPPED",
      );

      console.log(
        "[continuation-reminder] Final stop message sent.",
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(
        `[continuation-reminder] Final stop message could not be sent: ${errorMessage}`,
      );
    } finally {
      if (this.generation === chainGeneration) {
        /* Preserve the completed reminder count for diagnostics and tests. */
        this.generation += 1;
      }
    }
  }

  private createReminderMessage(
    reminderNumber: number,
  ): string {
    return [
      "KEYNU_CONTINUATION_REQUEST",
      "",
      `Reminder #${reminderNumber} of ${this.maxReminders}.`,
      "No assistant message has been detected since the previous REPORT.",
      "Please evaluate the REPORT and continue the active Keynu mission.",
    ].join("\n");
  }

  private isCurrentChain(
    chainGeneration: number,
  ): boolean {
    return (
      this.active &&
      this.generation === chainGeneration
    );
  }
}
