# Esbiko GitHub Actions mission runner

`.github/workflows/esbiko-keynu-mission.yml` is the first cloud execution harness for a real Keynu mission.

It is manual (`workflow_dispatch`) and has two modes:

- **prepare** — clone Esbiko into an isolated Keynu workspace, create a `keynu/*` local mission branch, install dependencies, establish the repository-owned verification baseline, bind the real workspace to the Esbiko plan, add the plan to persistent mission state, and upload evidence. No AI provider is called.
- **run** — performs the same preparation and baseline, then executes the reasoning mission and emits the Mission Impact Report. It requires the `OPENAI_API_KEY` GitHub Actions secret. `KEYNU_MISSION_MODEL` may be supplied as a repository variable.

## Safety boundary

The workflow has only `contents: read` permission. It cannot push its mission branch, modify `main`, create a deployment, or merge a pull request using the workflow token.

The mission itself also forbids push/merge/deploy/external services. The resulting diff is exported as `esbiko-mission.patch` and is an artifact for human review.

No synthetic failure is introduced. The four Esbiko repository-owned checks run before reasoning so a pre-existing baseline failure is distinguishable from a Keynu-created regression.

## Evidence artifact

Each run uploads, where available:

- workspace preparation JSON
- workspace inspection JSON
- binary-capable Git patch
- baseline build/simulation/Platform API/WebMCP logs
- prepared plan with pinned base commit
- Keynu execution state/evidence
- Markdown and JSON Mission Impact Reports in run mode

Artifacts are retained for 14 days.

## Why manual dispatch first?

A reasoning mission can consume provider budget and can modify its isolated checkout. It therefore must not run automatically on every push or pull request. Automated CI continues to validate Keynu itself; the real Esbiko mission is an explicit experiment.
