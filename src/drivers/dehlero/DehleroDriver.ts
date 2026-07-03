import axios from "axios";
import type { Driver } from "../../core/Driver.js";

const DEHLERO_API = "http://localhost:5173/api/dehlero";

type DehleroCommand = {
  action: string;
  payload?: unknown;
};

type DehleroHealthResponse = {
  service?: string;
  ok?: boolean;
};

export class DehleroDriver implements Driver {
  readonly id = "dehlero";

  async initialize(): Promise<void> {
    try {
      const health = await this.healthCheck();
      console.log("Dehlero Driver Ready:", health.service ?? "dehlero");
    } catch {
      console.warn("Dehlero Driver Ready, but Dehlero API is not reachable.");
    }
  }

  async execute(command: unknown): Promise<void> {
    const taskCommand = command as DehleroCommand;

    try {
      if (taskCommand.action === "ping") {
        const health = await this.healthCheck();
        console.log("Dehlero ping OK:", health);
        return;
      }

      if (taskCommand.action === "sendCommand") {
        await this.sendCommand(taskCommand.payload);
        console.log("Sent command to Dehlero.");
        return;
      }

      throw new Error(`Unknown Dehlero action: ${taskCommand.action}`);
    } catch (error) {
      throw new Error(this.formatError(error));
    }
  }

  private async healthCheck(): Promise<DehleroHealthResponse> {
    const res = await axios.get(`${DEHLERO_API}/health`, {
      timeout: 3000,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    if (!res.data || typeof res.data !== "object") {
      throw new Error("Invalid Dehlero health response. Expected JSON object.");
    }

    const data = res.data as DehleroHealthResponse;

    if (data.service !== "dehlero" && data.ok !== true) {
      throw new Error("Invalid Dehlero health response. Dehlero service not confirmed.");
    }

    return data;
  }

  private async sendCommand(payload: unknown): Promise<void> {
    await this.healthCheck();

    const res = await axios.post(`${DEHLERO_API}/command`, payload, {
      timeout: 5000,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    if (!res.data || typeof res.data !== "object") {
      throw new Error("Invalid Dehlero command response. Expected JSON object.");
    }
  }

  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNREFUSED") {
        return `Dehlero API is not reachable at ${DEHLERO_API}. Is Dehlero running?`;
      }

      if (error.response) {
        return `Dehlero API returned HTTP ${error.response.status}.`;
      }

      return `Dehlero API request failed: ${error.message || error.code || "unknown axios error"}`;
    }

    if (error instanceof Error) {
      return error.message || "Unknown Dehlero driver error.";
    }

    return String(error) || "Unknown Dehlero driver error.";
  }
}
