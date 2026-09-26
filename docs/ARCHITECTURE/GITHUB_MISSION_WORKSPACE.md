# GitHub Mission Workspace

Keynu mission execution requires a real filesystem `projectRoot` because builds, tests and repository-owned tools execute there. The GitHub Mission Workspace creates that filesystem from a GitHub repository without allowing the mission to work directly on the repository's base branch.

## Lifecycle

```text
GitHub owner/repo
  -> isolated clone of base branch
  -> keynu/<mission> branch
  -> Mission Runner projectRoot
  -> edits / build / tests / recovery / evidence
  -> inspect diff
  -> reviewed commit/push/PR (separate governed step)
```

`prepare` performs only clone + local mission branch creation. It does **not** push, create a pull request, merge, deploy or delete a remote branch.

## Prepare

```bash
npm run build
npm run github-workspace -- prepare amin076/science-web-lab main keynu/esbiko-improvement-001 .keynu/workspaces
```

The command returns JSON containing the isolated `projectRoot` and the exact `baseCommit`. Use that `projectRoot` for the execution plan.

## Inspect

```bash
npm run github-workspace -- inspect <projectRoot>
```

Inspection reports the current branch, short Git status and diff stat. Review this evidence before any future push/PR step.

## Safety decisions

- Repository input is `owner/repo`, not an arbitrary Git URL.
- Mission branches must begin with `keynu/`.
- Existing workspace directories are refused rather than silently reused or cleaned.
- Clone is single-branch and starts from an explicit base branch.
- The base commit is captured after checkout.
- Failure during clone/branch creation removes only the newly allocated workspace.
- Remote mutation is intentionally outside this first version.

This separation keeps `main` as the source of truth while giving Keynu the local filesystem required for deterministic build and verification.

## Esbiko

Esbiko is the first intended consumer. The workspace layer is generic and can later be reused for ClaimFlow, Tital, Dishmook, Melakat and other repositories without adding project-specific clone logic.
