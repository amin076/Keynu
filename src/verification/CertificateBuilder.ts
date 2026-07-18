import type { VerificationResult } from "./VerificationResult.js";

export type VerificationCertificate = {
  id: string;
  status: VerificationResult["status"];
  createdAt: string;
  verification: VerificationResult;
};

export class CertificateBuilder {
  create(result: VerificationResult): VerificationCertificate {
    return {
      id: `keynu-cert-${Date.now()}`,
      status: result.status,
      createdAt: new Date().toISOString(),
      verification: result,
    };
  }
}
