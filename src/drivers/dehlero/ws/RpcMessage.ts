export interface RpcMessage {
  id: string;
  method: string;
  payload?: unknown;
}