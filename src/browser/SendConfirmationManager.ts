export type SendConfirmationStatus =
  | 'SENT'
  | 'WAITING_CONFIRMATION'
  | 'FAILED'
  | 'RETRYING';

export interface SendConfirmationState {
  status: SendConfirmationStatus;
  messageId?: string;
  attempts: number;
  updatedAt: string;
}

export class SendConfirmationManager {
  private state: SendConfirmationState = {
    status: 'WAITING_CONFIRMATION',
    attempts: 0,
    updatedAt: new Date().toISOString()
  };

  start(messageId?: string): void {
    this.state = {
      status: 'WAITING_CONFIRMATION',
      messageId,
      attempts: this.state.attempts,
      updatedAt: new Date().toISOString()
    };
  }

  confirm(): void {
    this.state.status = 'SENT';
    this.state.updatedAt = new Date().toISOString();
  }

  retry(): void {
    this.state.status = 'RETRYING';
    this.state.attempts += 1;
    this.state.updatedAt = new Date().toISOString();
  }

  fail(): void {
    this.state.status = 'FAILED';
    this.state.updatedAt = new Date().toISOString();
  }

  getState(): SendConfirmationState {
    return this.state;
  }
}
