import axios from "axios";
import type { Driver, DriverResult } from "../../core/Driver.js";

const DEHLERO_API = "http://localhost:5173/api/dehlero";

export class DehleroDriver implements Driver {
  readonly id = "dehlero";

  async initialize(): Promise<void> {
    try {
      const res = await axios.get(`${DEHLERO_API}/health`);
      console.log("Dehlero Driver Ready:", res.data.service);
    } catch {
      console.warn("Dehlero Driver Ready, but Dehlero API is not reachable.");
    }
  }

  async execute(command: unknown): Promise<DriverResult> {
    const taskCommand = command as {
      action: string;
      payload?: unknown;
    };

    if (taskCommand.action === "sendCommand") {
      const res = await axios.post(`${DEHLERO_API}/command`, taskCommand.payload);
      return {
        success: true,
        message: "Command sent to Dehlero.",
        data: res.data,
      };
    }

    if (taskCommand.action === "ping") {
      const res = await axios.get(`${DEHLERO_API}/health`);
      return {
        success: true,
        message: "Dehlero health check completed.",
        data: res.data,
      };
    }

    throw new Error(`Unknown Dehlero action: ${taskCommand.action}`);
  }
}
