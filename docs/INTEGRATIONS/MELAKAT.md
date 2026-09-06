# Melakat Integration Foundation

Status: MelakatDriver and real cross-repository campaign smoke verified; evidence-discovery actions added; restart/resume proof pending

## Purpose

Keynu is being prepared to continuously develop and research Melakat. The integration is deliberately split into two layers:

1. Keynu **Engineering Runtime** owns generic project operations such as filesystem IO, command/script execution, Git, build, test, and verification.
2. **MelakatDriver** owns only Melakat-specific semantics such as experiment validation/execution and scientific artifact interpretation.

Melakat remains the source of truth for its simulation code, scientific world contracts, experiment specifications, tests, and reproducible evidence.

## Project registration

`config/missions/projects.json` registers Melakat as a sibling project with the default repository root:

```text
../melakat
```

This matches the standard local layout:

```text
C:\Physics\Keynu
C:\Physics\melakat
```

For another machine or layout, set:

```text
KEYNU_PROJECT_ROOT_MELAKAT=<absolute-or-relative-project-root>
```

MissionRegistry resolves a project-specific environment override before the repository-configured fallback. The generalized convention is:

```text
KEYNU_PROJECT_ROOT_<PROJECT_ID>
```

with non-alphanumeric project ID characters converted to underscores and the key uppercased.

## Current Melakat mission

Mission definition:

```text
config/missions/melakat/melakat-development.json
```

The mission focuses on:

- validating Melakat experiment specifications;
- running headless campaigns through the existing `melakat-experiment` CLI;
- reading canonical campaign/summary/validation/checksum evidence;
- identifying observed extinction runs for targeted inspection without inferring cause;
- surfacing experimental-integrity failures such as failed invariants, reproducibility mismatch, or incomplete run counts;
- preserving scientific controls and reproducibility;
- proving restart/resume behavior through Keynu mission persistence.

## Driver boundary

MelakatDriver does **not** implement its own:

- arbitrary file IO;
- PowerShell or Node process layer;
- Git branch/stage/commit layer;
- generic build/test command runner;
- generic verification sequencer.

Those remain shared Engineering Runtime responsibilities.

The current driver capabilities are:

```text
melakat.status
melakat.validateExperiment
melakat.runExperiment
melakat.readCampaign
melakat.readValidation
melakat.compareConditions
melakat.evidenceSummary
melakat.findExtinctions
melakat.findAnomalies
```

`melakat.findAnomalies` is intentionally an **experimental-integrity** inspection action. It does not label organisms, genotypes, behavior, or ecology as biologically anomalous. It only surfaces canonical validation evidence such as invariant failures, failed reproducibility, run-count mismatch, or a non-passing validation artifact.

## Current Melakat CLI contract

The Melakat repository exposes:

```text
melakat-experiment validate <spec> [--seed-count N] [--seed-start N] [--ticks N]
melakat-experiment run <spec> --output-dir <dir> [--seed-count N] [--seed-start N] [--ticks N] [--quiet]
```

MelakatDriver delegates command execution to Engineering Runtime. It first checks the standard Melakat virtual-environment entry points:

```text
desktop/.venv/Scripts/melakat-experiment.exe
desktop/.venv/bin/melakat-experiment
```

and otherwise falls back to `melakat-experiment` on `PATH`.

For safety and evidence locality, specification and output paths accepted by the domain actions must remain project-relative and may not escape the Melakat repository.

## Campaign validity and evidence

A successful campaign writes:

```text
campaign.json
summary.json
validation.json
runs.csv
comparison.csv
provenance.json
SHA256SUMS.txt
```

`melakat.runExperiment` treats a campaign as successful only when both conditions hold:

1. the delegated process execution succeeds; and
2. `validation.json` is readable and reports `passed: true`.

The driver returns repository-relative evidence references rather than moving scientific truth into Keynu mission memory.

`melakat.compareConditions` does not invent a new comparison algorithm. It reads the canonical `baseline_condition`, `conditions`, and `comparisons` already produced by Melakat's `summary.json`.

`melakat.evidenceSummary` compresses canonical evidence for KAP/mission use without replacing the underlying files. It reports run/condition counts, baseline, validation status, reproducibility evidence, the SHA256 manifest, and repository-relative evidence paths.

`melakat.findExtinctions` scans canonical campaign run records for `active_population === 0`. An extinction result is an observed run outcome only; the action does not infer why it occurred.

## Verified real cross-repository smoke

The first real Keynu -> Melakat smoke passed in GitHub Actions on 2026-09-06:

```text
Keynu branch head: cd8c98404697f83acb5a8b0838999d3acbd78f52
Melakat source:     3c9f49a3bc0993ad95e226df88412a0ba689e3bb
Smoke run:          34039786447
PR smoke run:       34039862056
```

The workflow checked out both repositories, built Keynu, installed the real Melakat experiment entry point, and invoked the real Phase Two energy-sweep specification through MelakatDriver. The reduced integration smoke used one seed and 40 ticks, yielding three condition runs. Validation passed with zero failures and deterministic repeat equality.

The smoke is **not** a scientific campaign and makes **no new scientific claim**. Its purpose is only to prove the integration path and canonical evidence readback. Persistent details are recorded in:

```text
docs/INTEGRATIONS/MELAKAT_SMOKE_EVIDENCE_2026-09-06.md
```

## Scientific rule

Automated execution does not weaken scientific discipline. Keynu may automate controlled runs and summarize evidence, but it must not infer adaptation, cooperation, competition, selection, navigation, or causal biological explanations beyond what the Melakat experiment design and results support.

## Remaining proof obligations

The remaining integration milestones are:

- validate the evidence-discovery actions against the real cross-repository smoke workflow;
- prove restart/resume after persisted Melakat work without replaying completed side effects;
- use the verified integration for controlled Phase Three development/research;
- keep workflow-continuation and mission-continuation architecture reconciled as Keynu evolves.
