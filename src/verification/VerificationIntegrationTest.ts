import { VerificationReportIntegration } from "./VerificationReportIntegration.js";

export function runVerificationIntegrationTest() {
  const integration = new VerificationReportIntegration();

  const result: any = {
    status: "COMPLETED",
    steps: [
      {
        result: {
          changed: ["test-file.ts"]
        }
      }
    ],
    build: {
      ok: true,
      output: "build passed"
    },
    git: {
      branch: {
        ok: true,
        stdout: "feature/keynu-dashboard-v01"
      },
      status: {
        ok: true,
        stdout: "clean"
      }
    }
  };

  return integration.createVerifiedReport(result);
}
