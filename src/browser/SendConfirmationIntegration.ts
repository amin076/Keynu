export class SendConfirmationIntegration {
  private started = false;

  start(): void {
    this.started = true;
  }

  isStarted(): boolean {
    return this.started;
  }

  confirm(): void {
    if (!this.started) {
      throw new Error("Confirmation started before send");
    }
  }

  fail(reason: string): never {
    throw new Error(reason);
  }
}