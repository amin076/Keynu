# Melakat Integration Foundation

Status: MelakatDriver v1 implemented; real cross-repository campaign smoke and restart/resume proof pending

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
- reading `campaign.json`, `summary.json`, `validation.json`, `runs.csv`, `comparison.csv`, provenance, and checksums;
- identifying extinctions/anomalous runs for targeted GUI inspection;
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

MelakatDriver v1 currently implements:

```text
melakat.status
melakat.validateExperiment
melakat.runExperiment
melakat.readCampaign
melakat.readValidation
melakat.compareConditions
```

The next domain layer will add targeted evidence discovery such as extinction/anomaly inspection without weakening the scientific interpretation rules.

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

## Scientific rule

Automated execution does not weaken scientific discipline. Keynu may automate controlled runs and summarize evidence, but it must not infer adaptation, cooperation, competition, selection, or navigation beyond what the Melakat experiment design and results causally support.

## Remaining proof obligations

MelakatDriver unit/regression coverage verifies command construction, virtual-environment CLI resolution, project-relative path containment, process-plus-validation gating, and canonical artifact reading. The remaining integration milestones are:

- run a small real Melakat campaign through Keynu against the actual Melakat repository;
- parse targeted extinction/anomaly inspection candidates from real artifacts;
- prove restart/resume after persisted Melakat work without replaying completed side effects.
