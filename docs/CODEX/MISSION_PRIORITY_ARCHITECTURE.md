# Mission Priority Architecture

Date: 2026-07-18

## Purpose

This document defines the target architecture for permanently fixing Keynu mission priority and preparing the project for OpenAI Build Week.

The design establishes one authoritative active-mission resolution path while preserving the current repository shape. It does not introduce a broad runtime redesign. The core change is to make configured mission priority authoritative, reconcile persisted state deterministically, and make BrowserAgent bootstrap and runtime consumers use the same resolved mission identity.

## Design Goals

- OpenAI Build Week remains the primary active mission until completed or explicitly changed by the user.
- A stale BrowserAgent session never suppresses required mission reconciliation.
- Mission registries, persisted mission state, session state, BrowserAgent bootstrap, continuation logic, and RuntimeGraphIntelligence agree on mission identity.
- Components do not read `.keynu/missions/state.json` directly when authoritative active-mission resolution is required.
- Startup behavior is deterministic and explainable.
- Existing persisted files remain backward compatible where practical.
- The work is incremental and testable.

## Current Flawed Execution Flow

```text
BrowserAgent startup
  -> SessionStore.read(.keynu/session/session.json)
  -> MissionBootstrapPolicy decides from session only
     - conversationUrl
     - memoryRestored
     - bootstrap pending timestamp
  -> if policy says restored/pending:
       skip MissionManager.prepare()
       do not reconcile .keynu/missions/state.json
       stale activeMissionId may remain
  -> if policy says restore:
       MissionManager.prepare()
         -> MissionRegistry.getActiveMission()
         -> MissionStateStore.setActiveMission(...)
         -> BootstrapBuilder.build()
```

This is flawed because mission identity is checked after the bootstrap decision, not before it. A stale session can suppress the only path that would reconcile runtime mission state.

Separately:

```text
RuntimeGraphIntelligence
  -> read .keynu/missions/state.json directly
  -> state.activeMissionId becomes the active mission for graph intelligence
```

This bypasses configured mission priority and can report an obsolete mission as active.

## Proposed Execution Flow

```text
BrowserAgent startup
  -> SessionStore.read(.keynu/session/session.json)
  -> ActiveMissionResolver.resolve()
     -> MissionRegistry.getActiveMission()
        configured mission priority comes from registry
     -> MissionStateStore.read()
     -> compare configured mission with persisted runtime mission
     -> compare configured mission with session mission metadata when present
     -> calculate required action:
        - NONE
        - RECONCILE_STATE
        - REQUIRE_BOOTSTRAP
        - BLOCKED
  -> ActiveMissionResolver.reconcileIfNeeded()
     -> if registry and state disagree:
          MissionStateStore.setActiveMission(configured mission)
          mark session mission restoration stale
     -> preserve historical mission records
  -> MissionBootstrapPolicy decides using:
       - conversation state
       - resolved mission identity
       - session mission identity
       - memory/bootstrap revision when present
       - resolver action
  -> if bootstrap required:
       MissionManager.prepareMessage({ projectId, conversationUrl })
       BootstrapBuilder records bootstrap for resolved mission
       SessionStore records mission/bootstrap metadata
  -> BrowserAgent starts with resolved mission context
```

Runtime consumers:

```text
MissionManager.getStatus()
  -> ActiveMissionResolver.resolve()
  -> ContextAssembler loads the resolved mission

RuntimeGraphIntelligence
  -> ActiveMissionResolver.resolve()
  -> may read MissionStateStore for lifecycle evidence
  -> must not treat state.activeMissionId as authoritative priority

BrowserContinuationCoordinator
  -> receives mission id from BrowserAgent or resolves active mission
  -> refuses/suppresses continuation for stale non-active mission unless explicitly addressed as historical
```

## Authoritative Source of Configured Mission Priority

Configured mission priority is the project registry, loaded through `MissionRegistry`.

Precedence remains:

1. `.keynu/missions/projects.json`
2. `config/missions/projects.json`

This matches current code and allows local runtime state to override repository fallback when intentionally configured. For the current repository, both registries select `openai-build-week`.

Mission definition lookup also remains:

1. `<projectRoot>/.keynu/missions/<projectId>/<missionId>.json`
2. `<repoRoot>/config/missions/<projectId>/<missionId>.json`

For Build Week, the mission definition currently lives at:

```text
config/missions/keynu/openai-build-week.json
```

## Component Responsibilities

### MissionRegistry

Role:

- Load configured mission priority.
- Load mission definitions.
- Validate mission definitions.
- Resolve relative project roots.

Limits:

- It does not persist runtime state.
- It does not decide bootstrap freshness.
- It does not read session state.
- It does not mutate `.keynu/missions/state.json`.

### MissionStateStore

Role:

- Persist runtime lifecycle state for missions.
- Store active runtime mission id as a cached/reconciled runtime projection.
- Preserve historical mission records.
- Record bootstrap, acknowledgement, job, recovery, pause, completion, and related lifecycle metadata.

Limits:

- It is not the authority for configured mission priority.
- `state.activeMissionId` is not allowed to override the registry.
- It should expose data needed for reconciliation but not independently choose a different active mission.

### ActiveMissionResolver

This is the one new component justified by the current repository. It should live under `src/mission/` and coordinate existing classes.

Role:

- Resolve authoritative active mission identity.
- Compare configured mission priority with persisted runtime mission state.
- Compare resolved mission with session mission metadata when available.
- Return a deterministic reconciliation action.
- Optionally apply state/session reconciliation when explicitly requested.
- Provide diagnostics for BrowserAgent, Dashboard, and tests.

Limits:

- It should not build bootstrap payloads.
- It should not send browser messages.
- It should not execute jobs.
- It should not delete historical mission or continuation files.

### MissionBootstrapPolicy

Role:

- Decide whether a bootstrap should be sent to the current conversation.
- Continue to protect against duplicate bootstraps in a short pending window.
- Use session conversation state as input.

Limits:

- It must not be the source of mission truth.
- It must not suppress bootstrap when the resolver says mission state is stale or a bootstrap is required.
- It must not decide configured active mission.

### SessionStore and session.json

Role:

- Persist browser-conversation restoration metadata.
- Track whether the current conversation has acknowledged the current resolved mission and memory revision.

Limits:

- Session does not select active mission.
- Session can allow skipping bootstrap only when it matches the resolved mission and relevant revision metadata.

Backward-compatible session additions should be optional:

```ts
type KeynuSession = {
  version: 1;
  conversationUrl?: string;
  memoryRestored: boolean;
  missionProjectId?: string;
  missionId?: string;
  missionBootstrapId?: string;
  missionMemoryRevision?: string;
  missionAcknowledgedAt?: string;
  missionRestorationStaleReason?: string;
  runtimeState: KeynuRuntimeState;
  // existing fields remain
};
```

Existing sessions without those fields load normally and are treated as mission-unknown. Mission-unknown sessions cannot suppress bootstrap if the resolver reports a mismatch or unknown acknowledgement.

### BrowserAgentApp

Role:

- Read session.
- Resolve and reconcile active mission before bootstrap policy can skip mission restoration.
- Pass the resolved mission id/project id into MissionManager bootstrap generation.
- Record mission/bootstrap metadata in session after bootstrap send and acknowledgement.

Limits:

- It should not implement mission selection logic itself.
- It should call the resolver rather than comparing JSON files inline.

### BrowserAgent

Role:

- Use `MissionManager`/resolver-provided active mission for job recording and continuation.
- On `MISSION_ACK`, update session metadata with acknowledged mission/bootstrap/revision.
- For KAP jobs with explicit `metadata.missionId`, verify whether they match the active mission or handle them as explicit historical/foreign mission work by policy.

Limits:

- It should not infer active mission from previous reports or continuation files.

### BrowserContinuationCoordinator

Role:

- Continue the resolved active mission after reports.
- Suppress stale continuation for non-active missions unless explicitly requested by a valid KAP mission id and policy.

Limits:

- Existing continuation files are historical records; their presence must not define the active mission.

### RuntimeGraphIntelligence

Role:

- Build runtime graph snapshots using resolved active mission identity.
- Read `MissionStateStore` as lifecycle evidence only.
- Surface mismatch diagnostics when configured and persisted state disagree.

Limits:

- It must not treat `.keynu/missions/state.json.activeMissionId` as authoritative when resolution is required.
- It should accept injected resolver/state paths for tests.

### Dashboard

Role:

- Display resolved active mission and conflict diagnostics.
- Avoid presenting stale persisted state as current priority without resolver context.

Limits:

- Dashboard remains a consumer; it should not resolve mission priority independently.

## TypeScript Interface Proposals

### ActiveMissionResolver

```ts
export type ActiveMissionResolutionAction =
  | "NONE"
  | "RECONCILE_STATE"
  | "REQUIRE_BOOTSTRAP"
  | "BLOCKED";

export type ActiveMissionResolutionReason =
  | "CONFIG_AND_STATE_MATCH"
  | "PERSISTED_STATE_MISSING"
  | "PERSISTED_ACTIVE_MISSION_MISMATCH"
  | "SESSION_MISSION_UNKNOWN"
  | "SESSION_MISSION_MISMATCH"
  | "SESSION_MEMORY_REVISION_MISMATCH"
  | "MISSION_DEFINITION_MISSING"
  | "REGISTRY_INVALID";

export type ActiveMissionResolution = {
  projectId: string;
  missionId: string;
  missionTitle: string;
  currentMilestone: string;
  configuredSourcePath?: string;
  missionDefinitionPath?: string;
  persistedActiveProjectId?: string;
  persistedActiveMissionId?: string;
  sessionProjectId?: string;
  sessionMissionId?: string;
  sessionMemoryRevision?: string;
  currentMemoryRevision?: string;
  action: ActiveMissionResolutionAction;
  reasons: ActiveMissionResolutionReason[];
  staleSession: boolean;
  stateMismatch: boolean;
  requiresBootstrap: boolean;
  diagnostics: string[];
};

export type ActiveMissionReconciliationResult = {
  resolution: ActiveMissionResolution;
  stateChanged: boolean;
  sessionChanged: boolean;
};

export class ActiveMissionResolver {
  resolve(options?: { projectId?: string; session?: KeynuSession }): ActiveMissionResolution;
  reconcile(options?: { projectId?: string; session?: KeynuSession }): ActiveMissionReconciliationResult;
}
```

Implementation note: if exposing source paths requires changing `MissionRegistry`, that can be deferred. The minimum viable resolver can report source precedence in diagnostics without adding source-path fields.

### MissionBootstrapPolicy

Extend the decision input rather than making the policy read files:

```ts
export type MissionBootstrapDecisionInput = {
  session: MissionBootstrapSession;
  conversationUrl: string;
  resolution: ActiveMissionResolution;
  nowMs?: number;
  pendingWindowMs?: number;
};

export type MissionBootstrapDecision = {
  isSameConversation: boolean;
  bootstrapPending: boolean;
  shouldRestoreMission: boolean;
  reason:
    | "NEW_CONVERSATION"
    | "SESSION_NOT_RESTORED"
    | "BOOTSTRAP_PENDING"
    | "MISSION_RECONCILIATION_REQUIRED"
    | "SESSION_MISSION_MISMATCH"
    | "SESSION_MEMORY_REVISION_MISMATCH"
    | "ALREADY_RESTORED";
};
```

Existing callers can be adapted through a compatibility wrapper during migration.

### MissionManager

Add resolver-aware status and preparation internally, preserving public methods:

```ts
prepare(options?: PrepareMissionOptions): MissionBootstrapPayload;
getStatus(projectId?: string): MissionManagerStatus;
getResolvedStatus(options?: { projectId?: string; session?: KeynuSession }): MissionManagerStatus;
```

The important behavior is that `getStatus()` and `prepare()` use the same resolution path.

### RuntimeGraphIntelligence

Allow resolver injection for tests and runtime consistency:

```ts
export type RuntimeGraphIntelligenceOptions = {
  rootDir?: string;
  missionStatePath?: string;
  graphSnapshotPath?: string;
  activeMissionResolver?: ActiveMissionResolver;
  maxActiveNodes?: number;
  maxRecentEdges?: number;
};
```

Snapshot should include:

```ts
resolution?: {
  missionId: string;
  action: ActiveMissionResolutionAction;
  stateMismatch: boolean;
  staleSession: boolean;
  diagnostics: string[];
};
```

## State Transition Rules

### Registry and State Match

Condition:

- `MissionRegistry.getActiveMission().mission.id === MissionStateStore.read().activeMissionId`

Result:

- No reconciliation required.
- Bootstrap policy may skip bootstrap only if session metadata matches the resolved mission and revision.

### Persisted State Missing

Condition:

- `.keynu/missions/state.json` missing or has no active mission.

Result:

- Resolver action: `RECONCILE_STATE`.
- `MissionStateStore.setActiveMission(resolved mission)` creates runtime projection.
- Bootstrap required unless session already contains matching mission/bootstrap/revision acknowledgement.

### Registry and State Disagree

Condition:

- Registry selects `openai-build-week`.
- State selects `react-mission-control-dashboard`.

Result:

- Registry wins.
- Resolver action: `RECONCILE_STATE` and `REQUIRE_BOOTSTRAP`.
- `MissionStateStore.setActiveMission(openai-build-week)` updates active runtime projection.
- Historical React state remains in `missions.react-mission-control-dashboard`.
- Session `memoryRestored` is set false or treated as false.
- BrowserAgent sends fresh Build Week bootstrap.

### Session Restored but Mission Unknown

Condition:

- `session.memoryRestored === true`
- session lacks `missionId` or `missionMemoryRevision`

Result:

- Treat as stale for mission-priority purposes.
- Require bootstrap unless a temporary compatibility rule is explicitly chosen. For Build Week preparation, prefer safety: require bootstrap.

### Session Restored for Different Mission

Condition:

- session mission id exists and differs from resolved mission id.

Result:

- Resolver flags stale session.
- Bootstrap required.
- Session restoration metadata updated after bootstrap send/ack.

### Previous BrowserAgent Session Restored

Condition:

- same conversation URL and pending/acknowledged bootstrap metadata exists.

Result:

- If session mission id and memory revision match the resolved mission, skip duplicate bootstrap according to pending/restored policy.
- If they do not match, previous session is stale and must not suppress bootstrap.

### Old Continuation Exists

Condition:

- continuation record exists for a non-active mission.

Result:

- Do not delete.
- Do not auto-deliver.
- Treat as historical or stale in diagnostics.

## Mission-State Reconciliation Timing

Reconciliation must happen:

1. At BrowserAgent startup before `MissionBootstrapPolicy` can skip bootstrap.
2. Before `MissionManager.prepareMessage()` builds a bootstrap.
3. Before `MissionManager.getStatus()` reports authoritative mission status.
4. Before `RuntimeGraphIntelligence.createSnapshot()` determines active mission.
5. Before continuation delivery decides the active mission for an implicit continuation.

Reconciliation should not happen:

- During simple file reads.
- Inside low-level stores.
- Inside display-only components.
- As a side effect of merely reading `.keynu/missions/state.json`.

## Registry-State Disagreement Policy

When configured priority and persisted runtime state disagree:

```text
Configured registry mission wins.
Persisted runtime state is reconciled to the registry mission.
Previous mission records are preserved as historical records.
Session restoration is stale.
Fresh Mission Bootstrap is required.
Diagnostics must identify both mission ids.
```

This policy is necessary for Build Week because the user has explicitly made `openai-build-week` the primary mission.

## Previous Session Restore Policy

Session restore can suppress bootstrap only when all are true:

- Conversation URL is unchanged.
- No bootstrap is pending beyond the configured window.
- `memoryRestored` is true.
- Session mission project id matches resolved project id.
- Session mission id matches resolved mission id.
- Session memory revision matches current memory revision, once implemented.
- Resolver action is `NONE`.

If any of these fail, bootstrap is required or pending according to explicit policy.

## ChatGPT and Codex Coordination

Future ChatGPT and Codex coordination should reuse the same mission identity:

- KAP metadata should carry `missionId` and optionally `workflowId`/`traceId`.
- Codex prepared jobs should include the resolved mission id.
- BrowserAgent reports and Codex reports should reference the same mission id.
- Continuation and graph events should use the resolved mission id.
- Session-specific transport metadata should not redefine the mission.

This allows ChatGPT and Codex to cooperate on Build Week without separate active-mission selection rules.

## Migration Strategy

### Persisted Files

Do not delete or rewrite existing mission records as a first step.

Backward compatibility rules:

- Missing session mission fields are valid.
- Missing memory revision fields are valid but cause conservative bootstrap behavior.
- Existing `.keynu/missions/state.json` mission entries are preserved.
- Existing continuation and delivery files remain as history.

### Runtime Behavior

Initial migration should:

1. Add resolver.
2. Add tests proving registry wins over stale state.
3. Integrate BrowserAgent startup reconciliation.
4. Extend session metadata.
5. Update graph intelligence to use resolver.

### Data Repair

Manual state edits should not be the permanent fix. The first runtime start after implementation should reconcile state through code and leave an auditable timestamp/update in `.keynu/missions/state.json`.

## Compatibility Risks

- Existing tests may assume `MissionBootstrapPolicy` only accepts session input.
- Existing tests may assume `RuntimeGraphIntelligence` reads only files and has no resolver dependency.
- Existing sessions without mission metadata will cause more bootstraps than before.
- Requiring bootstrap on mission mismatch may send a visible bootstrap into an existing conversation.
- If `MissionStateStore.setActiveMission()` preserves an old terminal status for a mission that becomes active again, a later phase may need explicit reactivation semantics.
- Codex driver/manual bridge does not yet participate in active mission resolution.

## Exact Source Files Expected to Change

Likely new files:

- `src/mission/ActiveMissionResolver.ts`
- `src/mission/tests/ActiveMissionResolver.test.ts`
- Possibly `src/mission/tests/BrowserAgentMissionReconciliation.test.ts`

Expected existing source changes:

- `src/mission/MissionManager.ts`
- `src/mission/MissionRegistry.ts` only if source-path diagnostics are added
- `src/mission/MissionStateStore.ts` only if helper methods are needed
- `src/mission/ContextAssembler.ts`
- `src/browser/MissionBootstrapPolicy.ts`
- `src/browser/BrowserAgentApp.ts`
- `src/browser/BrowserAgent.ts`
- `src/session/sessionTypes.ts`
- `src/session/createDefaultSession.ts` only if default fields are needed; optional fields do not require defaults
- `src/app/dashboardSession.ts` if session summaries expose mission metadata
- `src/app/dashboardServer.ts` if conflict diagnostics are surfaced through `/api/status`
- `src/graph/RuntimeGraphIntelligence.ts`
- `src/graph/tests/RuntimeGraphIntelligence.test.ts`
- `src/mission/BrowserContinuationCoordinator.ts`
- `src/mission/tests/BrowserContinuationCoordinator.test.ts`

Expected documentation updates after implementation:

- `.keynu/memory/current_state.md`
- `.keynu/memory/next_steps.md`
- possibly `docs/KEYNU_START_HERE.md`
- possibly `docs/ADR/ADR-0012-MISSION-BOOTSTRAP-V2.md`

Those memory/docs updates should be done only after code behavior is verified.

## Test Strategy

### Unit Tests

Add resolver tests:

- Registry and state match -> action `NONE`.
- State missing -> `RECONCILE_STATE`.
- State active mission differs from registry -> registry wins and bootstrap required.
- Session missing mission metadata -> stale session or bootstrap required.
- Session mission differs -> bootstrap required.
- Matching session mission/revision -> no bootstrap required when conversation policy allows.

Update bootstrap policy tests:

- Same conversation restored but mission mismatch -> bootstrap required.
- Pending bootstrap for same mission -> pending remains true.
- Pending bootstrap for different mission -> bootstrap required.

Update graph intelligence tests:

- Stale state says React but registry says Build Week -> snapshot active mission is Build Week.
- Snapshot includes mismatch diagnostics.

Update continuation tests:

- Continuation defaults to resolved active mission.
- Non-active continuation does not auto-deliver without explicit policy.

### Integration Tests

Add startup-oriented integration test with isolated temp repo:

1. Local/project registry selects Build Week.
2. State file says React dashboard active.
3. Session says restored.
4. BrowserAgentApp startup decision path should require bootstrap and reconcile state.

If BrowserAgentApp is too coupled to Playwright/browser for a first test, test a smaller orchestration function extracted for startup reconciliation.

### Validation Commands

Use build and focused tests first:

```powershell
npm run build
node dist/mission/tests/ActiveMissionResolver.test.js
node dist/browser/tests/MissionBootstrapPolicy.test.js
node dist/graph/tests/RuntimeGraphIntelligence.test.js
node dist/mission/tests/BrowserContinuationCoordinator.test.js
```

Then run the broader compiled regression suite if available or continue the existing project pattern for compiled test files.

## Implementation Phases

1. Add resolver with isolated tests.
2. Extend session types and bootstrap policy inputs.
3. Integrate resolver into BrowserAgent startup before bootstrap decision.
4. Make MissionManager status and prepare use resolver consistently.
5. Update RuntimeGraphIntelligence to use resolver for active mission identity.
6. Gate continuation against resolved active mission.
7. Add dashboard diagnostics.
8. Update repository memory and stale docs after verified behavior.

## Acceptance Criteria

- With registries selecting `openai-build-week` and state selecting `react-mission-control-dashboard`, the resolver selects Build Week and reports mismatch diagnostics.
- BrowserAgent startup cannot skip bootstrap solely because session says restored when the resolved mission differs.
- `MissionStateStore` active mission is reconciled through code, not manual state editing.
- RuntimeGraphIntelligence reports Build Week as active in the mismatch scenario.
- Existing mission records and continuation files remain present.
- Tests prove the behavior without relying on the real current `.keynu` files.
- Build passes after implementation.
