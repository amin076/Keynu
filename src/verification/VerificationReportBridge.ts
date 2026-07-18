import type { RuntimeExecutionResult } from "../core/results/RuntimeExecutionResult.js";
import { VerificationRuntimeAdapter } from "./VerificationRuntimeAdapter.js";

export type VerifiedReportPayload = {
  execution: RuntimeExecutionResult;
  verification: ReturnType<VerificationRuntimeAdapter["verify"]>["verification"];
  certificate?: ReturnType<VerificationRuntimeAdapter["verify"]>["certificate"];
};

export class VerificationReportBridge {
  private readonly adapter = new VerificationRuntimeAdapter();

  create(result: RuntimeExecutionResult): VerifiedReportPayload {
    const verificationResult = this.adapter.verify(result);

    return {
      execution: result,
      verification: verificationResult.verification,
      certificate: verificationResult.certificate,
    };
  }
}
