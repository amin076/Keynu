# Keynu Engineering Runtime v1

Status: implementation milestone

## Purpose

The Engineering Runtime is Keynu's reusable software-development center. Domain drivers must not duplicate generic filesystem, process, shell, Git, build, test, or verification logic.

Keynu therefore separates:

- **Engineering Runtime** — generic project-scoped software-engineering operations;
- **Domain drivers** — application-specific semantics and interpretation;
- **Mission runtime** — persistent goals, continuation, memory, recovery, and AI/KAP orchestration.

A future `MelakatDriver` should understand Melakat experiments and artifacts, but should delegate ordinary repository work to this Engineering Runtime.

## v1 capabilities

The built-in `engineering` driver exposes:

### Project-scoped filesystem

- `fs.readFile`
- `fs.writeFile`
- `fs.createFolder`
- `fs.listDirectory`
- `fs.exists`

Filesystem operations reuse the canonical filesystem adapter, including workspace containment and protected `.keynu/memory` write blocking.

### Commands and scripts

- `command.run`
- `script.run`

Scripts support the existing Keynu runtimes: Node.js, PowerShell, Python, and Bash. Working directories are constrained to the declared project root.

### Local Git operations

- `git.status`
- `git.currentBranch`
- `git.diff`
- `git.log`
- `git.createBranch`
- `git.switchBranch`
- `git.stage`
- `git.commit`

The v1 Git surface intentionally does not provide push, force-push, hard reset, or clean operations. Destructive Git command forms are blocked from the generic command path.

### Verification

- `project.verify`

This runs an ordered list of existing Keynu `CommandSpec` operations and stops at the first failure unless that command explicitly requests `runAfterFailure`.

## Project-root contract

Every Engineering Runtime operation requires a `projectRoot`.

- The root must already exist and be a directory.
- Relative command working directories resolve under this root.
- Absolute or relative working directories that escape the root are rejected.
- Filesystem paths are passed through canonical workspace containment checks.

This prevents domain integrations from silently operating against the wrong repository.

## Safety boundary

Engineering Runtime v1 is a development runtime, not a complete operating-system sandbox.

The current boundary provides:

- project-root containment for filesystem operations and command working directories;
- protected Keynu repository-memory enforcement for generic file writes;
- direct process spawning rather than shell-string interpolation for ordinary commands;
- blocking of known system-level destructive commands;
- blocking of destructive Git forms such as `reset --hard`, `clean`, and force push.

Future policy work may add stronger command authorization, external-side-effect approval, process isolation, and project-specific permission profiles.

## Compatibility

The existing `filesystem` driver remains registered for KAP 1.0 and frozen compatibility surfaces. New project integrations should prefer `engineering.*` capabilities.

## Melakat integration rule

`MelakatDriver` may add actions such as:

- validate an experiment specification;
- execute a Melakat campaign;
- read campaign/validation artifacts;
- compare conditions;
- find extinctions or anomalous runs.

It must not reimplement:

- file reads/writes;
- PowerShell or Node execution;
- Git branch/commit operations;
- package build/test execution;
- generic verification sequencing.

Those remain shared Engineering Runtime responsibilities.
