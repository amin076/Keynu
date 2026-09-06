# Melakat Integration

Status: registered through Integration Hub; real execution, evidence discovery, and restart-safe continuation verified

## Purpose

Keynu continuously develops and researches Melakat while preserving a strict boundary between generic runtime tooling and scientific semantics.

The integration now has three layers:

1. **Engineering Runtime** owns generic project operations: filesystem IO, command/script execution, Git, build, test, and verification.
2. **Integration Hub** owns application registration, capability discovery, project/connector routing, and shared connector mechanics.
3. **Melakat Integration Pack** owns Melakat-specific semantics such as experiment validation/execution and scientific artifact interpretation.

Melakat remains the source of truth for simulation code, world contracts, experiment specifications, tests, and reproducible scientific evidence.

## Registration

Melakat is registered as data in:

```text
config/integrations/melakat.json
```

Manifest schema:

```text
keynu-app-manifest-0.1
```

The manifest declares the `melakat` application, its project mapping, available connector kinds, capability risk metadata, and the capabilities handled by the Melakat Integration Pack.

Project-root resolution continues to support:

```text
KEYNU_PROJECT_ROOT_MELAKAT=<absolute-or-relative-project-root>
```

and the project registration in `config/missions/projects.json`.

## Runtime routing

Public capabilities are no longer hard-coded as `driver: melakat` entries in `registerBuiltinDrivers.ts`. They are loaded dynamically from the Melakat app manifest and routed through the central Integration Hub:

```text
melakat.runExperiment
        |
CapabilityRegistry
        |
integration compatibility bridge
        |
IntegrationHub
        |
Melakat Integration Pack
        |
Engineering Runtime + canonical Melakat artifacts
```

Current capabilities:

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

The historical `MelakatDriver` remains registered for direct legacy commands and is reused by the v1 pack as a compatibility implementation. It is no longer the primary capability-registration path. The next migration can move the remaining semantic implementation into the pack/service and leave the legacy driver as a thin adapter or remove it when direct-driver compatibility is no longer required.

## Why Melakat still needs an Integration Pack

A generic connector can launch a CLI or read a file, but it must not invent research semantics.

For Melakat, successful process execution alone does not make a campaign valid. `melakat.runExperiment` requires both:

1. successful delegated process execution; and
2. readable canonical `validation.json` evidence with `passed: true`.

Similarly, `findExtinctions`, `findAnomalies`, condition comparison, and evidence summaries have explicit scientific interpretation boundaries. Those rules belong in the Melakat Integration Pack, not in generic CLI/File connectors.

## Current Melakat CLI contract

```text
melakat-experiment validate <spec> [--seed-count N] [--seed-start N] [--ticks N]
melakat-experiment run <spec> --output-dir <dir> [--seed-count N] [--seed-start N] [--ticks N] [--quiet]
```

The current compatibility implementation checks:

```text
desktop/.venv/Scripts/melakat-experiment.exe
desktop/.venv/bin/melakat-experiment
```

and otherwise falls back to `melakat-experiment` on `PATH`.

Specification and output paths remain repository-relative and may not escape the Melakat project root.

## Canonical campaign evidence

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

Keynu reads these artifacts but does not replace them with its own scientific truth.

`melakat.compareConditions` reads canonical `baseline_condition`, `conditions`, and `comparisons` from `summary.json`.

`melakat.evidenceSummary` compresses canonical evidence for KAP/mission use while retaining repository-relative evidence paths and checksums.

`melakat.findExtinctions` reports run records with `active_population === 0` as observed outcomes only; it does not infer cause.

`melakat.findAnomalies` is an experimental-integrity action only. It surfaces invariant failures, reproducibility mismatches, incomplete run counts, or non-passing validation evidence. It does not label biological behavior as anomalous.

## Verified real cross-repository execution

The Keynu -> Melakat integration has been exercised against the real repositories. The original reduced cross-repository smoke invoked the Phase Two energy-sweep specification through Keynu, completed three condition runs, and produced passing validation with deterministic repeat equality.

Evidence is recorded in:

```text
docs/INTEGRATIONS/MELAKAT_SMOKE_EVIDENCE_2026-09-06.md
```

This smoke is an integration proof, not a scientific campaign.

## Verified restart/resume proof

Keynu also proved that a completed Melakat experiment side effect is not replayed after a simulated runtime interruption. The proof persisted a completed KAP REPORT, recreated the persistent runtime services, recovered the undelivered report, delivered continuation exactly once, executed a distinct read-only follow-up action, and suppressed duplicate continuation on another recreation.

Evidence is recorded in:

```text
docs/INTEGRATIONS/MELAKAT_RESTART_RESUME_EVIDENCE_2026-09-07.md
```

This is a runtime-safety proof, not a biological or evolutionary result.

## Scientific rule

Automation does not weaken scientific discipline. Keynu may execute controlled runs, inspect canonical evidence, and continue verified missions, but it must not infer adaptation, cooperation, competition, selection, navigation, or causal biological explanations beyond what Melakat experiment design and evidence support.

## Architecture rule for future applications

Melakat is now the migration example for the broader Keynu rule:

> A new application should not require new Keynu core code.

New applications should first register a manifest and use shared connectors. An Integration Pack is added only for genuine domain semantics. Generic filesystem, shell, Git, build, test, process, CLI, and future protocol mechanics must remain centralized rather than copied into per-app code.
