# Keynu Runtime Readiness Audit — 2026-09-06

Status: active implementation audit

This is a source-driven audit of the current Keynu repository. It separates implemented behavior from historical/aspirational documentation and prepares Keynu to act as a persistent software-development and research runtime for Melakat and other projects.

## Audit goals

1. Reconstruct the current architecture from repository code and documentation.
2. Find correctness, persistence, safety, portability, continuation and architecture defects.
3. Remove verified generated/runtime garbage without breaking frozen compatibility contracts.
4. Establish a reusable central software-engineering runtime so domain drivers do not duplicate OS/IO/Git/build/test/process capabilities.
5. Prepare the mission/runtime layer for autonomous, resumable Melakat development and research work.

## Source-of-truth separation

- **Keynu repository code and persisted runtime state** own orchestration, execution tools, mission progress, continuation and runtime memory.
- **Domain repositories such as Melakat** own their application/scientific code, versioned contracts, tests and evidence artifacts.
- KAP is the application-level protocol between AI connectors and Keynu. Browser automation is one transport, not the architecture itself.

## Current architecture observed

The repository contains several generations of runtime code and compatibility layers:

- `src/core/*`: compatibility façade, driver manager, command bus, event bus and `Agent` composition;
- `src/runtime/*`: KAP interpretation/validation adapters, provider runtime, command/script execution, scheduler/orchestrator and persistence helpers;
- `src/mission/*`: mission registry/state, bootstrap/acknowledgement, active-mission resolution and continuation delivery;
- `src/workflow/*`: workflow persistence and workflow-derived continuation helper;
- `src/drivers/*`: filesystem, PowerShell and domain drivers;
- `src/memory/*` and `src/graph/*`: protected repository memory plus graph/event memory;
- `src/browser/*`: browser transport and BrowserAgent KAP loop;
- `apps/mission-control/*`: React Mission Control dashboard.

ADR-0011 freezes compatibility surfaces. Refactoring must therefore classify canonical versus compatibility paths instead of deleting overlapping layers blindly.

## Confirmed high-priority defects

### P0/P1 — execution continuity and correctness

1. **Generic runtime jobs do not enter autonomous continuation.** BrowserAgent invokes the continuation coordinator after the direct PowerShell/filesystem route, but generic runtime/driver jobs send a report and record mission state without calling the continuation coordinator. A new domain integration such as Melakat can therefore stop after one job.
2. **KAP job idempotency is process-local.** BrowserAgent relies on in-memory processed-ID sets although `PersistentJobStore` already exists. A process restart can execute the same KAP job again, violating KAP idempotency.
3. **Active-mission precedence is not actually central.** `ActiveMissionResolver` implements deterministic precedence, but `MissionManager.getActiveMission()` still reads the registry directly, so browser bootstrap/continuation can disagree with other resolution paths.
4. **Workflow continuation is present but not wired into the actual browser runtime.** `BrowserContinuationCoordinator` accepts a `WorkflowContinuationService`, but MissionManager does not provide one.
5. **Autonomous-step budget is weak across turns/restarts.** Continuation state is persisted, but the coordinator does not derive the authoritative previous autonomous step count from persisted continuation state before deciding whether to continue.

### P1 — safety, persistence and portability

6. **Filesystem root containment is Windows-only.** The generic filesystem adapter uses `fullPath.startsWith(root + "\\")`; ordinary POSIX child paths fail this check. The existing PowerShell file-ops helper already demonstrates a cross-platform `relative()`-based containment check.
7. **Generic filesystem operations bypass protected repository-memory policy.** The adapter can write/remove/move `.keynu/memory/knowledge.jsonl`, contradicting the canonical `ProtectedMemoryPolicy` and the repository-memory rules.
8. **MISSION_ACK schema and runtime requirements disagree.** Runtime types/MissionManager require bootstrap-correlation fields that canonical KAP validation does not require.
9. **Mission state writes are not atomic.** `MissionStateStore` writes directly to the state file although restart-safety documentation requires durable state.

### P1/P2 — engineering architecture

10. **No GitHub CI exists.** Many self-running TypeScript tests and build scripts exist, but no `.github/workflows` gate enforces them.
11. **Generic software-engineering operations are scattered.** File IO, shell/process execution, scripts, PowerShell helpers, build/patch/context and verification exist without one project-scoped engineering service. This encourages every new domain driver to reimplement generic engineering work.
12. **Several runtime abstractions overlap.** `src/core/Runtime.ts`, `src/runtime/*`, `src/kernel/*`, services and the large `Agent` compatibility façade represent different generations. ADR-0011 means this requires staged migration, not destructive cleanup.

### P2 — repository hygiene and documentation drift

13. **Generated JavaScript/declaration/map files are tracked beside TypeScript sources** under `src/index`, `src/core` and `src/drivers/filesystem`. These build outputs can drift and, with NodeNext `.js` specifiers, create avoidable source-resolution ambiguity during TypeScript development.
14. `src/kap/KapExtractor.ts.backup` is a backup artifact candidate.
15. Historical runtime output is tracked under `processed/` even though the path is now ignored.
16. Root manual test-output text files appear to be historical smoke artifacts and require reference checks before removal.
17. `package.json` contains a stale `build:mission-control` command for old `src/app/react-dashboard`; the active dashboard lives under `apps/mission-control`.
18. Documentation contains stale/aspirational statements and continuation documents whose persistence layouts/API names no longer exactly match current code.
19. The repository mission registry still points to the July `openai-build-week` mission rather than the current runtime-readiness/Melakat objective.

## Refactoring rule for domain integrations

A future `MelakatDriver` must contain only Melakat-specific semantics such as validating/running `melakat-experiment` specifications and interpreting Melakat artifacts. It must **not** reimplement generic filesystem, shell, Git, process, build or test operations.

Those generic capabilities belong in a reusable Engineering Runtime shared by all projects.

## Planned implementation sequence

1. CI and a deterministic comprehensive test entry point.
2. Filesystem containment/protected-memory fixes.
3. Mission resolution, atomic persistence, KAP acknowledgement and restart-safe idempotency fixes.
4. Unified post-job continuation for routed and generic runtime jobs; persisted autonomous-step accounting.
5. Central Engineering Runtime v1 built on existing safe primitives.
6. Verified source-tree garbage cleanup and stale-script cleanup.
7. Current architecture/status documentation reconciliation.
8. Activate a new Keynu runtime-readiness/Melakat mission.
9. Implement Melakat domain integration and resumable development/research mission templates.

## Non-goals of the first readiness pass

- rewriting every legacy runtime layer;
- breaking KAP 1.0 compatibility without a migration path;
- deleting ADR-0011 compatibility APIs merely because a newer abstraction exists;
- granting autonomous missions destructive or externally consequential authority without explicit policy/approval;
- moving Melakat scientific truth into Keynu memory.
