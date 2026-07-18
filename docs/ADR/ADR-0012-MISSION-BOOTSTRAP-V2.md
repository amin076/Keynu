# ADR-0012 — Mission Bootstrap V2

## Status

Proposed

## Date

2026-07-14

## Context

Keynu must restore reliable project and mission context whenever it connects to a new AI conversation.

The current implementation already provides:

- repository-backed mission memory
- `MISSION_BOOTSTRAP` generation
- `MISSION_ACK` validation
- conversation-aware bootstrap policy
- duplicate-bootstrap suppression during a short pending window
- persistent session and mission state
- regression tests for new-conversation restoration

The current flow is:

`BrowserAgentApp -> MissionBootstrapPolicy -> MissionManager -> BootstrapBuilder -> MISSION_BOOTSTRAP -> MISSION_ACK -> BrowserAgent`

The current implementation works, but bootstrap completion is primarily inferred from the conversation URL, `memoryRestored`, and timestamps. The acknowledgement does not strongly correlate itself with the exact bootstrap envelope or the exact repository-memory revision that was sent.

## Problems

1. `MISSION_ACK` does not reference the originating bootstrap ID.
2. Bootstrap completion does not record a deterministic memory revision.
3. Acknowledgement of an older bootstrap can potentially be accepted after a newer bootstrap is sent.
4. Timeout recovery is based on a fixed five-minute pending window without retry history or bounded backoff.
5. Legacy onboarding fallback does not prove that repository memory was restored.
6. Session state does not expose all bootstrap lifecycle stages.
7. Dashboard APIs cannot explain why bootstrap is pending, stale, rejected, retried, or acknowledged.
8. A conversation may remain marked restored after important mission-memory files change.

## Decision

Implement Mission Bootstrap V2 as a deterministic, correlated, restart-safe state machine.

### Bootstrap identity

Every bootstrap must contain:

- `bootstrapId`
- `projectId`
- `missionId`
- `conversationUrl`
- `memoryRevision`
- `contextRevision`
- `attempt`
- `createdAt`

The existing KAP envelope `id` remains the transport identifier. The payload will also explicitly expose `bootstrapId` for correlation and future protocol evolution.

### Memory revision

Keynu will calculate a stable SHA-256 revision from the ordered content and paths of the repository-memory documents included in the bootstrap.

At minimum, the revision source includes:

- `.keynu/memory/current_state.md`
- `.keynu/memory/architecture.md`
- `.keynu/memory/decisions.md`
- `.keynu/memory/next_steps.md`
- `.keynu/memory/startup_prompt.md`
- active mission definition
- relevant protocol version

The revision must be deterministic and must not include volatile timestamps.

### Required acknowledgement correlation

`MISSION_ACK` must include:

- `payload.bootstrapId`
- `payload.projectId`
- `payload.missionId`
- `payload.memoryRevision`
- `payload.status`
- `payload.understoodMilestone`

Keynu must reject an acknowledgement when:

- the bootstrap ID is unknown
- the bootstrap is no longer the active attempt
- the conversation does not match
- the mission or project does not match
- the memory revision does not match
- the acknowledgement has already been consumed

### Bootstrap lifecycle

The lifecycle states are:

- `NOT_REQUIRED`
- `PREPARING`
- `SENDING`
- `AWAITING_ACK`
- `ACKNOWLEDGED`
- `STALE`
- `RETRY_SCHEDULED`
- `FAILED`

`memoryRestored` remains available temporarily for compatibility, but the lifecycle state becomes the source of truth.

### Retry policy

Retries must be bounded and persisted.

Initial policy:

- acknowledgement timeout: five minutes
- maximum automatic attempts: three
- backoff: immediate, thirty seconds, two minutes
- no duplicate retry while an active attempt is still valid
- retry state survives process restart

After the maximum automatic attempts, the state becomes `FAILED` and Keynu reports the required human action clearly.

### Legacy fallback

Legacy onboarding must not mark memory as restored.

It may be sent only as a visible recovery message after bootstrap generation or transport failure. The session must remain in `FAILED` or `AWAITING_ACK` until a valid correlated acknowledgement is received.

### Memory-change invalidation

Before skipping bootstrap for an existing conversation, Keynu must compare the acknowledged memory revision with the current repository-memory revision.

When the revisions differ:

- the previous acknowledgement becomes stale
- a new bootstrap is required
- the new bootstrap references the updated revision

### Persistent state

Session or mission state must retain:

- active bootstrap ID
- active bootstrap attempt
- bootstrap lifecycle state
- sent timestamp
- acknowledgement timestamp
- acknowledged memory revision
- current memory revision
- retry count
- last bootstrap error
- conversation URL

### Events

Mission Bootstrap V2 emits structured events:

- `mission.bootstrap.preparing`
- `mission.bootstrap.sent`
- `mission.bootstrap.awaiting_ack`
- `mission.bootstrap.acknowledged`
- `mission.bootstrap.rejected`
- `mission.bootstrap.stale`
- `mission.bootstrap.retry_scheduled`
- `mission.bootstrap.failed`

No event or console message may contain the complete bootstrap payload or complete AI message content.

### Dashboard support

The future React dashboard must display:

- lifecycle state
- project and mission
- active bootstrap ID
- attempt and retry count
- sent and acknowledged times
- current and acknowledged memory revisions
- stale or failure reason
- a manual safe-retry action

The React dashboard remains a major project priority, but Bootstrap V2 reliability is completed first because the dashboard depends on trustworthy runtime state.

## Implementation sequence

1. Add deterministic memory-revision calculation.
2. Extend mission and session types with Bootstrap V2 state.
3. Add bootstrap ID and memory revision to the bootstrap payload.
4. Require correlated fields in `MISSION_ACK`.
5. Implement acknowledgement rejection rules.
6. Replace boolean bootstrap policy with lifecycle-state decisions.
7. Add persisted retry and timeout handling.
8. Add structured bootstrap events.
9. Add API endpoints for bootstrap state.
10. Expose Bootstrap V2 state in the React dashboard.

## Compatibility

- KAP remains version `1.0` during the initial implementation.
- Existing `memoryRestored` fields remain temporarily readable.
- Existing mission records will be migrated lazily when first loaded.
- Old acknowledgements without Bootstrap V2 correlation fields will be rejected once V2 enforcement is enabled.

## Verification requirements

The implementation is complete only when tests prove:

1. a new conversation receives exactly one active bootstrap
2. a matching acknowledgement activates the mission
3. an old acknowledgement cannot acknowledge a newer bootstrap
4. an acknowledgement with the wrong memory revision is rejected
5. changed repository memory invalidates a previous acknowledgement
6. restart during `AWAITING_ACK` preserves the active attempt
7. retries are bounded and duplicate sends are prevented
8. legacy fallback never sets restored state
9. logs contain lifecycle metadata but not complete message payloads
10. the existing clean-new-chat regression suite remains successful

## Consequences

### Positive

- deterministic restoration
- stronger protection against stale AI context
- reliable restart recovery
- clear runtime observability
- safer support for multiple AI connectors
- trustworthy data for the React dashboard

### Costs

- additional session and mission-state fields
- migration logic for current state files
- more acknowledgement validation
- new retry and lifecycle tests

## Source of truth

Repository memory and persisted Keynu state remain the source of truth. Chat history is never treated as authoritative project memory.
