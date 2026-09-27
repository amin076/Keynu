# GitHub mission orchestration

This layer connects the generic GitHub Mission Workspace to Keynu's existing execution plans.

A plan template may contain a placeholder/local `projectRoot`. Preparation performs an isolated GitHub checkout, creates the required `keynu/*` branch, captures the base commit, then writes a new immutable prepared-plan file whose `projectRoot` is the isolated checkout.

It also appends repository, mission-branch and pinned-base-commit provenance to the plan rules so those facts become part of mission evidence/context.

## Esbiko

After building Keynu:

```bash
npm run github-mission -- amin076/science-web-lab main keynu/esbiko-improvement-001 .keynu/workspaces examples/esbiko/esbiko-real-improvement.plan.json .keynu/prepared-plans
```

The JSON result contains the exact prepared-plan path and project root.

Then add and run that prepared plan with an execution config whose state/scripts are available to the runner. The existing Esbiko verifier remains the completion gate.

## Deliberate boundary

Preparation does not run the AI mission, install project dependencies, push a branch, create a PR, merge or deploy. Those remain explicit lifecycle stages. This prevents a repository URL from becoming an implicit remote-mutation permission.

No failure is injected for demonstration. Recovery only occurs when a real execution/verification failure is observed.
