import { runPowerShellRuntimeJob } from "./powershell-runtime.js";
import type { KapJob, PowerShellFileOpsJobPayload } from "./powershell-types.js";

export class PowerShellDriver {
  async run(job: KapJob<PowerShellFileOpsJobPayload>) {
    return runPowerShellRuntimeJob(job);
  }
}
