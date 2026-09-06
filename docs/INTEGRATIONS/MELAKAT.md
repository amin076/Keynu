# Melakat Integration Foundation

Status: mission/configuration foundation; domain driver pending

## Purpose

Keynu is being prepared to continuously develop and research Melakat. The integration is deliberately split into two layers:

1. Keynu **Engineering Runtime** owns generic project operations such as filesystem IO, command/script execution, Git, build, test, and verification.
2. A future **MelakatDriver** owns only Melakat-specific semantics such as experiment validation/execution and scientific artifact interpretation.

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

MelakatDriver must **not** implement its own:

- arbitrary file IO;
- PowerShell or Node process layer;
- Git branch/stage/commit layer;
- generic build/test command runner;
- generic verification sequencer.

Those are shared Engineering Runtime responsibilities.

The driver may implement actions such as:

```text
melakat.status
melakat.validateExperiment
melakat.runExperiment
melakat.readCampaign
melakat.readValidation
melakat.compareConditions
melakat.findExtinctions
melakat.findAnomalies
```

The exact action contract must follow the real Melakat CLI and artifact schemas, not a duplicated Keynu schema.

## Current Melakat CLI contract

The Melakat repository exposes:

```text
melakat-experiment validate <spec> [--seed-count N] [--seed-start N] [--ticks N]
melakat-experiment run <spec> --output-dir <dir> [--seed-count N] [--seed-start N] [--ticks N] [--quiet]
```

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

The driver should treat `validation.json.passed` plus process exit status as the primary campaign validity signal and preserve paths/checksums as evidence references.

## Scientific rule

Automated execution does not weaken scientific discipline. Keynu may automate controlled runs and summarize evidence, but it must not infer adaptation, cooperation, competition, selection, or navigation beyond what the Melakat experiment design and results causally support.
