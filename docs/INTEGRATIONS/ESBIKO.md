# Esbiko real mission

This example connects Keynu to the existing Esbiko repository (`science-web-lab`) for a real bounded engineering mission.

## Safety boundary

The mission is intentionally not a scripted fake failure. The reasoning step must inspect repository evidence and select one bounded improvement. Existing files can only be changed through `project.write`, which requires the SHA-256 returned by a prior `project.read`. The mission forbids deployment, publishing, credentials/config identity changes, deliberate breakage, broad refactors and unsupported scientific changes.

One targeted recovery attempt is enabled. If normal execution or deterministic verification fails, Keynu creates its bounded escalation packet and may request one minimal repair. It does not get an unlimited repair loop.

## Repository layout assumption

The example assumes sibling checkouts:

```text
<workspace>/
  Keynu/
  science-web-lab/
```

The configured Esbiko root is therefore `../../../science-web-lab` relative to the files under `Keynu/examples/esbiko`.

## Verification

The trusted adapter accepts only these Esbiko-owned npm scripts:

- `build`
- `lint`
- `sim:check`
- `test:platform-api`
- `test:webmcp`

The initial mission requires build, simulation validation, Platform API tests and WebMCP tests before completion. Lint is available to the agent as a diagnostic/verification capability but is not a completion gate because the current repository must first establish its lint baseline.

## Run locally

Build Keynu first, then from the Keynu repository:

```bash
npm run build
npm run mission -- add examples/esbiko/config.json examples/esbiko/esbiko-real-improvement.plan.json
npm run mission -- run examples/esbiko/config.json
npm run mission -- report examples/esbiko/config.json esbiko-real-improvement-001
```

A configured OpenAI-compatible execution provider is required for the reasoning run. Adding the plan and reading status/report data do not themselves require a provider.

Before a live run, start from a clean Esbiko working tree. Review the resulting diff before committing anything to Esbiko.

## IBM Bob

This integration does not invoke IBM Bob and does not measure Bobcoin usage. A later controlled Bob handoff can use Keynu's bounded evidence rather than sending the whole repository.
