# Legacy workflow compatibility boundary

The `src/workflow` subsystem is retained for compatibility and historical reference. It is **not** the active continuation runtime for Keynu missions.

## Canonical continuation authority

The active runtime is composed in `src/browser/BrowserAgent.ts` and routes completed runtime reports through:

- `BrowserContinuationCoordinator`
- `ContinuationStore`
- `ContinuationDeliveryStore`
- `ContinuationDeliveryService`
- `PersistentJobStore`

Those components provide the restart-safe and idempotent mission continuation contract used by current Keynu execution.

## What remains legacy here

`WorkflowController`, `WorkflowEventBridge`, `WorkflowContinuationService`, `WorkflowJobGenerator`, and `RuntimeScheduler` belong to the older workflow path. In particular, `RuntimeScheduler` keeps its queue in memory. Scheduling a workflow step through that path must therefore **not** be described as restart-safe.

The legacy subsystem must not be wired into `BrowserAgent` or another active runtime composition root alongside the canonical continuation coordinator. Doing so would create a second report-continuation initiator and could reintroduce duplicate continuation behavior.

`src/workflow/tests/LegacyWorkflowIsolation.test.ts` enforces this compatibility boundary in CI.

## Design rule

New mission continuation work must extend the canonical mission continuation types and stores rather than adding persistence to the legacy workflow queue. If a deterministic local continuation mode is needed in the future, represent it through the canonical continuation contract (for example `LOCAL_CONTINUE`) and give it an explicit restart-safe execution design before making it active.
