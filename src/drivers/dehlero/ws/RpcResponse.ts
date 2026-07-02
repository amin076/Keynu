export interface RpcResponse {
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
}