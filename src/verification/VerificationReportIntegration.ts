import type { RuntimeExecutionResult } from "../core/results/RuntimeExecutionResult.js";
import { VerificationRuntimeAdapter } from "./VerificationRuntimeAdapter.js";
import { CertificateBuilder } from "./CertificateBuilder.js";

export class VerificationReportIntegration {
  private readonly verifier = new VerificationRuntimeAdapter();
  private readonly certificates = new CertificateBuilder();

  createVerifiedReport(result: RuntimeExecutionResult) {
    const verificationResult = this.verifier.verify(result);
    const certificate = verificationResult.certificate;

    return {
      execution: result,
      verification: verificationResult.verification,
      certificate,
    };
  }
}
