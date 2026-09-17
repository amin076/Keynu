# ADR-0014: Supervised API mission execution

Status: Accepted, 2026-09-17. Extended by ADR-0015 for shared adapter locks, monitoring and schedules.

## Problem

The browser is the only operational composition root for autonomous mission continuation.
OpenAI generation, script execution and mission memory already exist, but do not compose
into a headless, dependency-aware, multi-project worker. The legacy in-memory workflow
scheduler is explicitly not the durable authority (ADR-0012).

## Decision

Add a transport-independent execution-plan extension inside `src/mission/execution`.
Its CLI composes the existing OpenAI provider, code-owned named functions, persisted
plans, evidence and a fresh review request. It uses the canonical ContinuationContract
(`LOCAL_CONTINUE`, `BLOCKED`, `COMPLETED`) and reads existing project MemoryLoader documents.
It does not wire or revive `src/workflow` or repurpose processed-job idempotency storage.

A plan has exactly one execution owner: the API worker. Existing browser missions retain
BrowserContinuationCoordinator as their authority. A plan must not be assigned to both.
This ADR extends ADR-0012's browser-only authority to explicit per-plan ownership;
it does not claim that browser continuation and API plan storage are already unified.
A future migration must translate plans and evidence explicitly, not dual-write silently.

One local scheduler owns a plan-store lock. Up to four workers operate on distinct
canonical project roots. Each worker also holds a project lock for cooperating API
workers in other stores. Browser workers and external editors do not honor that lock;
use separate worktrees or stop the browser worker for that project. Locks are not a
security boundary or distributed leases. Nested/overlapping project roots require care.

## Persistence and recovery

Plans contain goals, rules, dependency order, capabilities and a per-step AI-call budget.
Intent and result evidence are separate immutable files. State snapshots are replaced
atomically and read-modify-write operations are locked. Corruption fails closed.
A completed step is never replayed on restart. A step left RUNNING becomes INTERRUPTED;
ambiguous side effects require reconciliation and explicit resume, retaining its budget.
Lock directories left by a killed owner are never automatically stolen. After confirming
all writers stopped, an operator removes stale lock directories and restarts the worker.
This is conservative recovery, not an exactly-once guarantee or unattended crash recovery.

## Verification and review

Required deterministic checks must pass before a separate AI review can approve a step.
The reviewer receives the goal, rules and recorded evidence and cannot execute tools.
The same model may serve both roles, so review is not independent ground truth.
The operator must define meaningful checks; `git.status` alone cannot validate a change.
The model cannot add capabilities, reset budgets or silently expand the plan.
Follow-up proposals are persisted; preapproved dependency-ready steps execute automatically.

## API and trust

Outbound OpenAI Responses requests use existing providers. No live key is embedded.
Inbound HTTP binds to loopback, requires a >=32-character bearer token, rejects browser
Origin headers and restricts submitted project roots/functions to host configuration.
It is a local API, not a publicly reachable ChatGPT connector or remote hosting service.
Scripts are registered by trusted configuration; arguments are JSON data in a temporary
file. They execute with the user's OS privileges. This is not an OS sandbox.
