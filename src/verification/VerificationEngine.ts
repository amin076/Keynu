import type { RuntimeExecutionResult } from "../core/results/RuntimeExecutionResult.js";
import type { VerificationResult } from "./VerificationResult.js";
import { resolveVerificationRequirements } from "./VerificationPolicy.js";
import { checkExecution } from "./checks/ExecutionCheck.js";
import { checkEvidence } from "./checks/EvidenceCheck.js";
import { checkFileChanges } from "./checks/FileChangeCheck.js";
import { checkBuild } from "./checks/BuildCheck.js";
import { checkGit } from "./checks/GitCheck.js";
import { checkArtifactIntegrity } from "./checks/ArtifactIntegrityCheck.js";

export class VerificationEngine {
  verify(result: RuntimeExecutionResult): VerificationResult {
    const requirements = resolveVerificationRequirements(result);

    const checks = [
      requirements.requireExecution ? checkExecution(result) : null,
      requirements.requireEvidence ? checkEvidence(result) : null,
      requirements.requireFiles ? checkFileChanges(result) : null,
      requirements.requireArtifactIntegrity ? checkArtifactIntegrity(result) : null,
      requirements.requireBuild ? checkBuild((result as any).build) : null,
      requirements.requireGit ? checkGit((result as any).git) : null,
    ].filter((check): check is NonNullable<typeof check> => check !== null);

    const passed = checks.every((check) => check.passed);

    return {
      status: passed ? "VERIFIED" : "FAILED",
      checks,
      messages: passed
        ? ["All verification checks passed."]
        : ["One or more verification checks failed."],
    };
  }
}
