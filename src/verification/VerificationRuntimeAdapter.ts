import type { RuntimeExecutionResult } from "../core/results/RuntimeExecutionResult.js";
import { VerificationEngine } from "./VerificationEngine.js";
import { CertificateBuilder } from "./CertificateBuilder.js";

export class VerificationRuntimeAdapter {
  private readonly engine = new VerificationEngine();
  private readonly certificates = new CertificateBuilder();

  verify(result: RuntimeExecutionResult) {
    const verification = this.engine.verify(result);

    const certificate =
      verification.status === "VERIFIED"
        ? this.certificates.create(verification)
        : undefined;

    return {
      verification,
      certificate,
    };
  }
}
