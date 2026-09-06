# ADR-0012 — Continuation runtime unification

**Status:** Accepted  
**Date:** 2026-09-07

## Context

Keynu currently contains two bodies of continuation-related code:

1. the active mission continuation runtime, wired from `src/browser/BrowserAgent.ts`, and
2. an older `src/workflow` subsystem that can react to runtime reports and enqueue a next workflow step through `RuntimeScheduler`.

The active mission path persists job/report state and continuation/delivery state. It has already been exercised by restart/resume evidence, including recovery of an undelivered report, suppression of duplicate continuation delivery, and execution of a distinct next action after restart.

The legacy workflow path is materially different. `RuntimeScheduler` owns an in-memory queue. `WorkflowController` and `WorkflowEventBridge` can each subscribe to `REPORT_CREATED`, and `WorkflowContinuationService` can ask `WorkflowJobGenerator` to enqueue another in-memory job. The current `BrowserAgent` composition root does not wire these legacy components.

An earlier runtime audit described the legacy workflow service as part of active browser continuation wiring. The current source no longer supports that statement: `BrowserContinuationCoordinator` is the active continuation coordinator and does not depend on `WorkflowContinuationService`.

## Decision

Keynu will have **one active continuation authority**: the mission continuation runtime centered on `BrowserContinuationCoordinator` and the persistent mission/job stores.

The `src/workflow` continuation path is classified as a **legacy compatibility boundary**, not a second runtime to be made independently persistent.

We will therefore:

- keep the legacy workflow source available for compatibility while it remains useful;
- prevent active runtime composition roots from importing or wiring legacy workflow continuation initiators;
- enforce that boundary in CI;
- describe the legacy `RuntimeScheduler` accurately as in-memory and not restart-safe;
- add new continuation semantics to the canonical mission contract instead of creating another persistence model;
- use canonical `LOCAL_CONTINUE`, `WAITING_AI`, and `TERMINATE` decisions when future continuation modes require them.

## Why we are not making `RuntimeScheduler` durable

`PersistentJobStore` is an idempotency and processed-job ledger; it is not a durable scheduling queue. Reusing it as a queue would conflate two different lifecycle contracts and could cause a merely scheduled job to be mistaken for an already claimed/processed job.

Building a second durable queue specifically for the legacy workflow subsystem would also preserve two continuation authorities and increase restart, replay, and duplicate-delivery complexity without evidence that the legacy scheduler is part of the current execution path.

If an active deterministic local scheduler is needed later, it should be designed explicitly around the canonical continuation contract and restart semantics rather than obtained by incrementally reviving the legacy workflow path.

## Consequences

### Positive

- One continuation source of truth in the active runtime.
- Existing restart/resume evidence remains representative of the actual execution path.
- Reduced risk of duplicate `REPORT_CREATED` continuation initiators.
- No misuse of `PersistentJobStore` as a queue.
- Future deterministic continuation can be added deliberately through canonical contracts.

### Trade-offs

- The old workflow scheduler remains non-durable while it is retained.
- Code under `src/workflow` must not be advertised as restart-safe.
- Consumers that intentionally depend on the legacy path remain compatibility consumers until migrated or removed.

## Enforcement

`src/workflow/tests/LegacyWorkflowIsolation.test.ts` scans current TypeScript source outside `src/workflow` and fails if legacy workflow continuation components escape the compatibility boundary. It also asserts that `BrowserAgent` wires `BrowserContinuationCoordinator` and routes runtime reports through `continueAfterReport`.

This turns the architectural decision into an executable CI contract rather than relying only on documentation.
