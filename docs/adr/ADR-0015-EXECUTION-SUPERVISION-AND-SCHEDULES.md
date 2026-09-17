# ADR-0015: Shared execution ownership, supervision and bounded schedules

Status: Accepted for implementation. Extends ADR-0014 without merging browser/API plan models.

## Shared ownership

API mission execution, the command executor, generic filesystem adapter and browser
PowerShell KAP adapter use one cooperative project lock. PowerShell command execution
also delegates to the same bounded command executor instead of separate shell policies.
Git subdirectories resolve to the checkout/worktree root. Different worktrees have
different owners. For non-Git projects, callers must use the same canonical root.

AsyncLocalStorage makes calls in the owner's execution chain reentrant. A scoped,
random ownership token is passed to child commands through their environment and checked
against the active lock owner file. This allows project tests to invoke Keynu without
blocking their parent. A stale token without its owner file does not grant reentrancy.
This coordinates trusted processes; it is not authorization or a security sandbox.

Conflicting unrelated owners wait for up to five seconds and then fail with Store busy.
External editors and drivers that bypass these adapters remain outside this mechanism.
Semantic ownership is still separate: serializing two AIs does not resolve conflicting
project goals. Use one designated plan owner and separate worktrees for unrelated work.

## Progress supervision

Every step records phase/action, call count and successful-action count. Heartbeats update
every ten seconds while a step is active without changing its last progress timestamp.
A stale heartbeat and a long period without stage progress are distinct observations.
Neither authorizes automatic replay, process killing or stale-lock takeover.

By default, every three successful named actions triggers a separate progress review;
reviewEveryActions=0 disables intermediate reviews, but never disables final verification
or final review. Progress reviews count against the same persistent AI-call budget.
The reviewer evaluates alignment before completion; it must not demand a finished goal
at an intermediate checkpoint. A negative review blocks further actions.

## Scheduling

An optional notBefore UTC timestamp delays the initial run. Optional recurrence copies
the approved plan only after every step has passed verification and final review.
maxRuns includes the initial run, is bounded to 2..365 and decreases in each successor.
A persistent nextPlanId prevents duplicate successors across restarts. Each occurrence
retains its own evidence and call budget. There is no silent catch-up burst: the successor
is scheduled one interval after it is enqueued. Blocked/interrupted work does not repeat.

watch polls while its process is alive. serve can opt into autoRun polling. POST /stop
persists a store-wide pause and requests cooperative stopping; a currently executing
subprocess is not forcibly terminated by that endpoint. POST /run explicitly clears the
pause. No operation bypasses provider quotas or starts a background OS service.

## Observation surfaces

Authenticated GET /monitor and credential-free local CLI monitor expose the same derived
observations. The existing loopback Mission Control dashboard reads the configured local
plan store through read-only /api/execution-monitor and renders it on the Missions page.
It never sends the execution API token to the browser or exposes new browser mutation routes.
