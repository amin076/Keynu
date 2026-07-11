import { SendConfirmationRuntimeAdapter } from "./SendConfirmationRuntimeAdapter.js";

export function runSendConfirmationRuntimeTest(): boolean {
  const adapter = new SendConfirmationRuntimeAdapter();

  adapter.startSend();
  adapter.confirmSend();

  return true;
}