import { VerificationReportIntegration } from "./VerificationReportIntegration.js";

export function runVerificationCheck() {
  const integration = new VerificationReportIntegration();

  const result: any = {
    status: "COMPLETED",
    steps: [
      {
        result: {
          changed: ["verification-test.ts"]
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

console.log(JSON.stringify(runVerificationCheck(), null, 2));
