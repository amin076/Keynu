# Keynu -> Melakat Cross-Repository Smoke Evidence — 2026-09-06

## Scope

This document records the first verified cross-repository execution in which Keynu invoked the real Melakat experiment interface through `MelakatDriver` and then read Melakat's canonical evidence artifacts.

This was an **integration smoke only**. It was deliberately reduced to one seed and 40 ticks and must not be cited as a scientific campaign or as evidence for a new biological/evolutionary claim.

## Source revisions

```text
Keynu branch head: cd8c98404697f83acb5a8b0838999d3acbd78f52
Melakat main:       3c9f49a3bc0993ad95e226df88412a0ba689e3bb
```

The Keynu branch was later merged through PR #15, producing merge commit:

```text
88850ad264ca746764dc65cadc9cbd7d00052ed5
```

## Workflow evidence

Branch smoke:

```text
workflow: Melakat cross-repository smoke
run id:   34039786447
result:   success
```

PR smoke:

```text
workflow: Melakat cross-repository smoke
run id:   34039862056
result:   success
```

The branch smoke uploaded evidence artifact:

```text
artifact name: melakat-keynu-smoke-34039786447
artifact id:   9991309567
zip SHA256:    d0fb6db1b05b924b8c5a157f8413f5f868096d7489a1fecb883b7e52347580a1
```

The workflow also passed the normal Keynu validation suite before merge.

## Real Melakat input

Specification:

```text
experiments/phase-two/local-resource-energy-sweep.json
```

Original specification contains three values of:

```text
world.energy_input_per_tick = 10.4, 20.0, 40.0
```

Integration-smoke overrides:

```text
seed count: 1
seed start: 1
ticks:      40
```

Output directory:

```text
results/keynu-integration-smoke
```

## Execution path proved

The workflow:

1. checked out Keynu;
2. checked out `amin076/melakat` at current `main`;
3. built Keynu;
4. installed the real Melakat package/CLI from `melakat/desktop`;
5. instantiated `MelakatDriver`;
6. called `melakat.status`;
7. called `melakat.validateExperiment`;
8. called `melakat.runExperiment`;
9. read `validation.json` through `melakat.readValidation`;
10. read `campaign.json` through `melakat.readCampaign`;
11. read canonical condition comparisons through `melakat.compareConditions`.

On the clean CI runner the resolved command was:

```text
melakat-experiment
```

with CLI source reported as `path` because the package was installed into the workflow Python environment.

## Recorded result

```text
experiment:       phase-two-local-resource-energy-sweep
run count:        3
condition count:  3
comparison count: 2
validation:       passed
failure count:    0
baseline:         local_resource_energy__energy_input_per_tick=10.4
```

Reproducibility target:

```text
condition: local_resource_energy__energy_input_per_tick=10.4
seed:      1
identical: true
```

Reference checksum:

```text
7c9d0388ad780ac8d6937596100ef7060347f7264678042df68f6215ea74d0fb
```

Repeat checksum:

```text
7c9d0388ad780ac8d6937596100ef7060347f7264678042df68f6215ea74d0fb
```

## Scientific interpretation boundary

The smoke proves that Keynu can invoke the actual Melakat experiment runner and consume canonical Melakat evidence across repositories. It does **not** establish a new result about population dynamics, extinction, adaptation, selection, cooperation, competition, navigation, or ecology.

Any scientific conclusion must come from an appropriately designed Melakat experiment campaign with suitable seeds, durations, controls, invariant checks, and causal interpretation.
