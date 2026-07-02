import type { DehleroMethod } from "./DehleroMethods.js";

export interface DehleroRequest {
  id: string;
  method: DehleroMethod;
  payload?: unknown;
}