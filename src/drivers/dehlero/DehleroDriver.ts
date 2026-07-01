import axios from "axios";
import type { Driver } from "../../core/Driver.js";

const DEHLERO_API = "http://localhost:5173/api/dehlero";

type DehleroCommand = {
  action: string;
  payload?: unknown;
};

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

  async execute(command: unknown): Promise<void> {
    const taskCommand = command as DehleroCommand;

    if (taskCommand.action === "sendCommand") {
      await axios.post(`${DEHLERO_API}/command`, taskCommand.payload);
      console.log("Sent command to Dehlero.");
      return;
    }

    if (taskCommand.action === "ping") {
      const res = await axios.get(`${DEHLERO_API}/health`);
      console.log(res.data);
      return;
    }

    console.warn("Unknown Dehlero action:", taskCommand.action);
  }
}
