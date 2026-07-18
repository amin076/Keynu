# Keynu Continuation Persistence

Status: Implemented foundation
Version: 0.1

## Purpose

Continuation state must survive BrowserAgent, runtime, browser and operating-system restarts.

## Storage

Each active mission receives an atomic JSON record under:

`.keynu/missions/continuations/<mission-id>.json`

## Stored Information

- schema version
- mission identifier
- last job identifier
- mission state
- continuation decision
- explicit reason
- next action
- next-action owner
- mission completion flag
- retryability
- resume token
- autonomous step count
- consecutive failure count
- last meaningful progress time
- update time

## Atomic Writes

The store writes a temporary file and renames it over the final record. This prevents a partially written continuation file from becoming the active state.

## Security

Mission identifiers are restricted to letters, digits, dots, underscores and hyphens. Directory traversal is rejected.

## BrowserAgent Integration

After every delivered report, BrowserAgent should evaluate or record a continuation decision.

When the decision owner is `ai` and autonomous continuation is allowed, BrowserAgent should send one follow-up request asking for:

- the next valid KAP JOB; or
- an explicit WAITING, BLOCKED, COMPLETED or FAILED declaration.

The follow-up request itself must be deduplicated and persisted before delivery.

## Restart Recovery

When BrowserAgent starts, it should inspect the active mission continuation record.

If the state is `WAITING_AI`, the previous request was not acknowledged and retry policy permits delivery, BrowserAgent may resend the continuation request using the stored resume token.

It must not resend indefinitely. Loop guards and attempt counters remain mandatory.
