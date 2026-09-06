# Melakat Restart/Resume Evidence — 2026-09-07

Status: verified runtime-safety proof; not a scientific campaign

## Purpose

This proof verifies that Keynu can persist the outcome of a real Melakat experiment job, recover after a simulated runtime restart, avoid replaying the completed side effect for the same KAP job ID, recover an undelivered REPORT, continue the mission exactly once, and then execute a distinct read-only Melakat evidence step.

It does **not** make a new scientific claim about digital evolution. The Melakat campaign is intentionally reduced to one seed and 40 ticks so the workflow tests runtime behavior rather than scientific conclusions.

## Real repositories and interfaces

The workflow checks out:

- `amin076/Keynu`
- `amin076/melakat` (`main`)

It builds Keynu, installs the real Melakat desktop experiment package, and uses `MelakatDriver` to execute:

```text
melakat.runExperiment
```

against:

```text
experiments/phase-two/local-resource-energy-sweep.json
```

with:

```text
seed count = 1
seed start = 1
ticks = 40
```

The follow-up job is deliberately distinct and read-only:

```text
melakat.evidenceSummary
```

## Restart boundary

The proof models three runtime processes using fresh persistence objects over the same durable state directory.

### Process 1

1. `PersistentJobStore.claim()` creates the experiment job record.
2. The job enters `RUNNING`.
3. `MelakatDriver` executes the real campaign exactly once.
4. Canonical Melakat validation passes.
5. Keynu persists the completed KAP REPORT.
6. The process is treated as having crashed before REPORT delivery and before continuation delivery.

### Process 2

1. A fresh `PersistentJobStore` claims the same job ID.
2. The claim is rejected as a duplicate because the completed record already exists.
3. The experiment is **not** executed again.
4. The previously persisted, undelivered REPORT is recovered and marked delivered.
5. A fresh `BrowserContinuationCoordinator` creates one continuation request telling the AI to select a new, distinct step and not repeat the completed action.
6. A new KAP job ID runs `melakat.evidenceSummary` successfully.

### Process 3

1. A third fresh `PersistentJobStore` again sees the original experiment job as completed.
2. The experiment remains unexecuted.
3. A fresh continuation coordinator reconstructs the same continuation request identity.
4. `ContinuationDeliveryStore` suppresses it as `SKIPPED_DUPLICATE`.

## Verified evidence

Branch workflow run:

```text
Melakat restart-resume proof: 34050445737
```

The proof ran with Bash `pipefail`, so a failing Node assertion fails the workflow rather than being hidden by `tee`.

Observed proof result:

```text
experimentExecutionCount: 1
originalJobReexecuted: false
reportPersistedBeforeCrash: true
recoveredUndeliveredReportAfterRestart: true
continuationDeliveryStatus: DELIVERED
duplicateContinuationDeliveryStatus: SKIPPED_DUPLICATE
continuationMessageCount: 1
duplicateContinuationMessageCount: 0
distinctNextAction: melakat.evidenceSummary
distinctNextActionSucceeded: true
validationPassed: true
failureCount: 0
reproducibilityIdentical: true
evidenceChecksumCount: 6
persistedAutonomousStepCount: 1
originalJobState: COMPLETED
evidenceJobState: COMPLETED
```

Uploaded workflow evidence:

```text
artifact ID: 9994372429
artifact ZIP SHA256: f99a9cfbbd1efd089d32853bef0f9bc74f0407be5a0caad8754614e27fe495d5
```

## Important CI correction discovered by this proof

The first version of the workflow piped the Node proof through `tee` without enabling Bash `pipefail`. A failing assertion could therefore be masked by `tee` returning exit code zero. The workflow was corrected to run:

```bash
set -o pipefail
node scripts/run-melakat-restart-resume-proof.mjs | tee melakat-restart-resume-proof.log
```

The corrected proof then passed. This correction is part of the evidence: a green workflow is only meaningful when the assertion process can propagate failure to GitHub Actions.

## What this proves

The evidence supports these runtime statements:

- a real Melakat experiment side effect can be guarded by Keynu's persistent KAP job identity;
- a completed job is not automatically replayed after restart;
- a REPORT persisted before interruption can be recovered after restart;
- continuation delivery has persistent duplicate suppression;
- the autonomous-step counter survives recreation of the continuation coordinator;
- the next mission step can be a distinct Melakat evidence action rather than repetition of the campaign.

## What this does not yet prove

This is not yet a claim that every Keynu process boundary, browser failure mode, operating-system crash, or arbitrary external side effect is transactionally recoverable. In particular:

- a crash while a side effect is still `RUNNING` remains intentionally fail-safe and requires recovery reasoning rather than automatic replay;
- `WorkflowContinuationService` is still a separate continuation path that should be reconciled with the persistent browser mission path;
- the proof uses a controlled CI restart simulation with new store/coordinator instances rather than killing and restarting a long-lived BrowserAgent operating a real ChatGPT browser session;
- npm dependency vulnerabilities reported by CI remain a separate maintenance item.

## Next milestone

With the core Melakat restart/resume safety contract demonstrated, Keynu can move to runtime consolidation:

1. reconcile `WorkflowContinuationService` with the persistent mission continuation path;
2. preserve one source of continuation truth and one persistent delivery/idempotency model;
3. clean verified generated/backup/runtime garbage without breaking compatibility contracts;
4. audit and resolve npm dependency vulnerabilities;
5. then use the hardened runtime for longer Melakat development and research missions.
