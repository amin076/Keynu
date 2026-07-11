import { SendConfirmationIntegration } from "./SendConfirmationIntegration.js";

export class SendConfirmationRuntimeAdapter {
  private integration: SendConfirmationIntegration;

  constructor() {
    this.integration = new SendConfirmationIntegration();
  }

  startSend(): void {
    this.integration.start();
  }

  confirmSend(): void {
    this.integration.confirm();
  }

  failSend(reason: string): void {
    this.integration.fail(reason);
  }
}