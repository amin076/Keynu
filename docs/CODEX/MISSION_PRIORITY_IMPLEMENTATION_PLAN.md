# Mission Priority Implementation Plan

Date: 2026-07-18

## Objective

Implement the mission-priority architecture in small verified phases so Keynu consistently resolves OpenAI Build Week as the active mission, reconciles stale runtime state, and prevents stale sessions from suppressing required Mission Bootstrap.

Do not manually edit `.keynu/missions/state.json` as the fix. State reconciliation must be performed by code and covered by tests.

## Phase 1: Add Active Mission Resolver Foundation

### Objective

Create a small resolver under `src/mission/` that selects the configured active mission through `MissionRegistry`, compares it with `MissionStateStore`, and returns a deterministic resolution result without changing behavior yet.

### Files to Inspect

- `src/mission/MissionRegistry.ts`
- `src/mission/MissionStateStore.ts`
- `src/mission/MissionManager.ts`
- `src/mission/MissionTypes.ts`
- `src/mission/tests/createIsolatedMissionManager.ts`
- existing mission tests under `src/mission/tests/`

### Files Expected to Change

- Add `src/mission/ActiveMissionResolver.ts`
- Add `src/mission/tests/ActiveMissionResolver.test.ts`
- Possibly update `src/mission/index.ts` if exports are maintained there

### Tests to Add or Update

Add isolated tests with temp directories:

- Registry active mission and state active mission match -> action `NONE`.
- State file missing -> action `RECONCILE_STATE`.
- State says `react-mission-control-dashboard`, registry says `openai-build-week` -> registry wins, `stateMismatch=true`, `requiresBootstrap=true`.
- Invalid/missing mission definition -> action `BLOCKED`.
- Historical mission records are detected but not deleted.

### Validation Commands

```powershell
npm run build
node dist/mission/tests/ActiveMissionResolver.test.js
```

### Rollback Considerations

This phase is additive. Rollback is limited to removing the new resolver file, new test file, and any index export.

### Completion Criteria

- Resolver can be tested without BrowserAgent or Playwright.
- Tests prove registry priority wins over stale persisted state.
- No runtime behavior changes yet.

## Phase 2: Add Reconciliation Method and Session Metadata Types

### Objective

Extend the resolver with an explicit `reconcile()` method and extend session typing so mission identity can be recorded without breaking old session files.

### Files to Inspect

- `src/session/sessionTypes.ts`
- `src/session/SessionStore.ts`
- `src/session/createDefaultSession.ts`
- `src/mission/MissionStateStore.ts`
- `src/mission/ActiveMissionResolver.ts`
- `src/mission/tests/BootstrapV2PersistentState.test.ts`

### Files Expected to Change

- `src/mission/ActiveMissionResolver.ts`
- `src/mission/tests/ActiveMissionResolver.test.ts`
- `src/session/sessionTypes.ts`
- Possibly `src/session/createDefaultSession.ts`

### Tests to Add or Update

- Resolver `reconcile()` updates active mission in `MissionStateStore` when state mismatches registry.
- Resolver preserves old mission records.
- Resolver marks session as stale or returns session patch intent when session mission differs.
- `SessionStore.read()` still accepts old sessions without mission metadata.

### Validation Commands

```powershell
npm run build
node dist/mission/tests/ActiveMissionResolver.test.js
```

### Rollback Considerations

New optional session fields are backward compatible. Rollback means removing resolver reconciliation and optional fields before any runtime code depends on them.

### Completion Criteria

- Reconciliation can update a temp mission-state file in tests.
- Existing session JSON shape remains valid.
- No BrowserAgent startup integration yet.

## Phase 3: Make Bootstrap Policy Mission-Aware

### Objective

Update `MissionBootstrapPolicy` so session state can only suppress bootstrap when it matches the resolved active mission and resolver action permits skipping.

### Files to Inspect

- `src/browser/MissionBootstrapPolicy.ts`
- `src/browser/tests/MissionBootstrapPolicy.test.ts`
- `src/browser/tests/NewConversationBootstrapRegression.test.ts`
- `src/mission/ActiveMissionResolver.ts`
- `src/session/sessionTypes.ts`

### Files Expected to Change

- `src/browser/MissionBootstrapPolicy.ts`
- `src/browser/tests/MissionBootstrapPolicy.test.ts`
- `src/browser/tests/NewConversationBootstrapRegression.test.ts`

### Tests to Add or Update

- Same conversation, `memoryRestored=true`, matching mission -> skip bootstrap.
- Same conversation, `memoryRestored=true`, different mission -> require bootstrap.
- Same conversation, pending bootstrap for same mission -> pending.
- Same conversation, pending bootstrap for different mission -> require bootstrap.
- Resolver action `RECONCILE_STATE` or `REQUIRE_BOOTSTRAP` -> require bootstrap.
- Legacy session with no mission id -> require bootstrap when resolver cannot prove match.

### Validation Commands

```powershell
npm run build
node dist/browser/tests/MissionBootstrapPolicy.test.js
node dist/browser/tests/NewConversationBootstrapRegression.test.js
```

### Rollback Considerations

Keep a compatibility wrapper for existing call sites until BrowserAgent integration is complete. Rollback can restore the previous session-only decision function.

### Completion Criteria

- Bootstrap policy remains pure and file-free.
- Tests prove stale session cannot suppress mission bootstrap.

## Phase 4: Integrate Resolver into BrowserAgent Startup

### Objective

Run mission resolution and reconciliation before BrowserAgent decides whether to send Mission Bootstrap.

### Files to Inspect

- `src/browser/BrowserAgentApp.ts`
- `src/browser/runBrowserAgent.ts`
- `src/browser/tests/BrowserAgentBootstrapOrdering.test.ts`
- `src/browser/tests/NewConversationBootstrapRegression.test.ts`
- `src/mission/MissionManager.ts`
- `src/session/SessionStore.ts`

### Files Expected to Change

- `src/browser/BrowserAgentApp.ts`
- Add or update a browser startup/reconciliation test
- Possibly `src/browser/tests/BrowserAgentBootstrapOrdering.test.ts`

### Tests to Add or Update

Prefer extracting a testable startup decision helper if direct `BrowserAgentApp` testing is too browser-coupled.

Test scenario:

- Registry selects Build Week.
- State says React Mission Control.
- Session says previous conversation restored.
- Startup requires bootstrap and reconciles state to Build Week.

Also test:

- Registry/state/session all match -> no unnecessary bootstrap.
- Pending bootstrap for resolved mission remains deduplicated.

### Validation Commands

```powershell
npm run build
node dist/browser/tests/MissionBootstrapPolicy.test.js
node dist/browser/tests/NewConversationBootstrapRegression.test.js
node dist/browser/tests/BrowserAgentBootstrapOrdering.test.js
```

Add the new startup reconciliation test command once the test exists.

### Rollback Considerations

This phase changes startup behavior. Rollback by reverting `BrowserAgentApp` integration while keeping resolver tests intact for follow-up.

### Completion Criteria

- Startup reconciles active mission before bootstrap skip.
- Build Week wins in the stale React state scenario.
- Existing duplicate-bootstrap protection still works for matching mission.

## Phase 5: Record Mission Metadata in Session on Bootstrap and Ack

### Objective

Persist resolved mission identity, bootstrap id, and memory revision in `.keynu/session/session.json` so future startup decisions can prove whether the session matches the current mission.

### Files to Inspect

- `src/browser/BrowserAgentApp.ts`
- `src/browser/BrowserAgent.ts`
- `src/mission/BootstrapBuilder.ts`
- `src/mission/MissionManager.ts`
- `src/session/sessionTypes.ts`
- `src/kap/KapValidator.ts`

### Files Expected to Change

- `src/browser/BrowserAgentApp.ts`
- `src/browser/BrowserAgent.ts`
- `src/session/sessionTypes.ts` if not already complete
- Possibly `src/mission/MissionManager.ts` to expose prepared bootstrap metadata cleanly

### Tests to Add or Update

- After bootstrap send, session contains `missionProjectId`, `missionId`, `missionBootstrapId`, and `missionMemoryRevision`.
- After valid `MISSION_ACK`, session remains restored only for the matching mission/bootstrap/revision.
- Old ack for previous mission does not mark current session restored.

### Validation Commands

```powershell
npm run build
node dist/mission/tests/BootstrapV2AcknowledgementValidation.test.js
node dist/browser/tests/MissionBootstrapPolicy.test.js
```

Add new BrowserAgent ack/session test command when available.

### Rollback Considerations

Session metadata is optional, so persisted files remain readable. Rollback removes writes and tests but can leave extra session fields harmlessly ignored.

### Completion Criteria

- Session restore has mission identity.
- Mission-aware bootstrap policy has real data to evaluate on subsequent starts.

## Phase 6: Make MissionManager Status Resolver-Aware

### Objective

Ensure `MissionManager.getStatus()`, `prepare()`, `recordJob()`, and lifecycle methods use the same resolved active mission path.

### Files to Inspect

- `src/mission/MissionManager.ts`
- `src/mission/ContextAssembler.ts`
- `src/mission/ActiveMissionResolver.ts`
- `src/mission/tests/KapAwareMissionBootstrap.test.ts`
- `src/mission/tests/ProjectContinuationBootstrap.test.ts`
- `src/mission/tests/MissionRecoveryStatePersistence.test.ts`

### Files Expected to Change

- `src/mission/MissionManager.ts`
- `src/mission/ContextAssembler.ts`
- Add/update mission manager tests

### Tests to Add or Update

- `MissionManager.getStatus()` reports Build Week when registry says Build Week and state says React.
- `MissionManager.prepare()` still builds Build Week bootstrap and records state.
- `recordJob()` records against resolved active mission.
- Existing Bootstrap V2 acknowledgement validation remains valid.

### Validation Commands

```powershell
npm run build
node dist/mission/tests/KapAwareMissionBootstrap.test.js
node dist/mission/tests/ProjectContinuationBootstrap.test.js
node dist/mission/tests/BootstrapV2AcknowledgementValidation.test.js
node dist/mission/tests/MissionRecoveryStatePersistence.test.js
```

### Rollback Considerations

If status behavior changes too much, rollback `MissionManager` wiring while keeping resolver available for BrowserAgent startup. Preserve tests that define desired behavior for the next attempt.

### Completion Criteria

- Mission status and bootstrap preparation agree on one active mission.
- Build Week is reported consistently under mismatch conditions.

## Phase 7: Update RuntimeGraphIntelligence

### Objective

Stop `RuntimeGraphIntelligence` from treating `.keynu/missions/state.json.activeMissionId` as authoritative when resolver data is available.

### Files to Inspect

- `src/graph/RuntimeGraphIntelligence.ts`
- `src/graph/RuntimeGraphRecommendationService.ts`
- `src/graph/tests/RuntimeGraphIntelligence.test.ts`
- `src/graph/tests/RuntimeGraphIntelligenceRecommendations.test.ts`
- `src/app/dashboardServer.ts`

### Files Expected to Change

- `src/graph/RuntimeGraphIntelligence.ts`
- `src/graph/tests/RuntimeGraphIntelligence.test.ts`
- `src/graph/tests/RuntimeGraphIntelligenceRecommendations.test.ts`
- Possibly `src/app/dashboardServer.ts` if resolver injection is needed

### Tests to Add or Update

- State says React, registry says Build Week -> graph snapshot active mission is Build Week.
- Snapshot includes diagnostics identifying stale persisted state.
- Existing missing/invalid file warning behavior remains intact.
- Recommendations receive resolved active mission id.

### Validation Commands

```powershell
npm run build
node dist/graph/tests/RuntimeGraphIntelligence.test.js
node dist/graph/tests/RuntimeGraphIntelligenceRecommendations.test.js
node dist/graph/tests/RuntimeGraphRecommendationService.test.js
```

### Rollback Considerations

If graph tests fail broadly, keep resolver in place and temporarily preserve old state-read behavior behind a fallback. Do not remove diagnostics tests without review.

### Completion Criteria

- Graph intelligence no longer revives stale React mission as active.
- Diagnostics make registry/state disagreement visible.

## Phase 8: Gate Continuation by Resolved Active Mission

### Objective

Ensure autonomous continuation only follows the resolved active mission unless a KAP message explicitly and validly targets another mission.

### Files to Inspect

- `src/browser/BrowserAgent.ts`
- `src/mission/BrowserContinuationCoordinator.ts`
- `src/mission/ContinuationStore.ts`
- `src/mission/ContinuationDeliveryService.ts`
- `src/mission/tests/BrowserContinuationCoordinator.test.ts`
- `src/browser/tests/BrowserAgentContinuationIntegration.test.ts`

### Files Expected to Change

- `src/browser/BrowserAgent.ts`
- `src/mission/BrowserContinuationCoordinator.ts`
- `src/mission/tests/BrowserContinuationCoordinator.test.ts`
- Possibly browser continuation integration tests

### Tests to Add or Update

- Completed report for resolved active mission creates continuation.
- Existing stale React continuation does not auto-deliver when Build Week is resolved active.
- KAP metadata mission id mismatch is handled explicitly by policy.

### Validation Commands

```powershell
npm run build
node dist/mission/tests/BrowserContinuationCoordinator.test.js
node dist/browser/tests/BrowserAgentContinuationIntegration.test.js
```

### Rollback Considerations

Continuation behavior affects autonomous loops. Rollback by restoring prior coordinator behavior while keeping resolver and bootstrap protections.

### Completion Criteria

- Old Mission Control continuation files remain but do not override Build Week.
- Continuation requests use the resolved active mission identity.

## Phase 9: Surface Diagnostics in Dashboard/API

### Objective

Expose active mission resolution diagnostics through status APIs so users can see why Build Week is active and whether persisted state was reconciled.

### Files to Inspect

- `src/app/dashboardServer.ts`
- `src/app/dashboardApi.ts`
- `src/app/dashboardSession.ts`
- `apps/mission-control/src/api/contracts.ts`
- `apps/mission-control/src/api/httpClient.ts`
- Existing dashboard tests under `src/app/tests/`

### Files Expected to Change

- `src/app/dashboardServer.ts`
- `src/app/dashboardSession.ts`
- Possibly `src/app/dashboardApi.ts`
- Dashboard tests under `src/app/tests/`
- React app only if diagnostics are required visually for Build Week; otherwise keep this API-level first

### Tests to Add or Update

- `/api/status` includes resolved mission and mismatch diagnostics.
- Dashboard status uses resolver output, not stale `state.activeMissionId`.
- Existing status contract remains backward compatible.

### Validation Commands

```powershell
npm run build
node dist/app/tests/MissionDashboardStatus.test.js
```

Run additional dashboard API tests if changed endpoints overlap.

### Rollback Considerations

Diagnostics are additive. Rollback can remove API fields while leaving resolver behavior intact.

### Completion Criteria

- Dashboard/API can explain configured active mission, persisted active mission, and resolution action.

## Phase 10: Update Repository Memory and Stale Docs

### Objective

After code behavior is verified, update repository memory and stale documentation so future AI sessions start with Build Week priority and the new resolution architecture.

### Files to Inspect

- `.keynu/memory/current_state.md`
- `.keynu/memory/next_steps.md`
- `.keynu/memory/decisions.md`
- `.keynu/memory/architecture.md`
- `docs/KEYNU_START_HERE.md`
- `docs/ADR/ADR-0012-MISSION-BOOTSTRAP-V2.md`
- `docs/CODEX/MISSION_PRIORITY_ARCHITECTURE.md`
- `docs/CODEX/MISSION_PRIORITY_IMPLEMENTATION_PLAN.md`

### Files Expected to Change

- `.keynu/memory/current_state.md`
- `.keynu/memory/next_steps.md`
- `.keynu/memory/decisions.md`
- `.keynu/memory/architecture.md`
- `docs/KEYNU_START_HERE.md`
- Possibly `docs/ADR/ADR-0012-MISSION-BOOTSTRAP-V2.md`

### Tests to Add or Update

No new code tests unless docs are referenced by tests. Read back changed memory files.

### Validation Commands

```powershell
npm run build
git status --short
```

If protected memory enforcement blocks direct replacement, use the repository-approved append or authorized replacement flow instead of bypassing policy.

### Rollback Considerations

Memory/doc updates should be made only after verified behavior. Rollback means restoring previous documentation content from git if explicitly approved, or applying a corrective follow-up commit.

### Completion Criteria

- New chats are told Build Week is primary.
- Stale Dashboard Mission Control priority text is removed or demoted.
- Architecture docs describe resolver behavior accurately.

## Recommended First Implementation Phase

Start with Phase 1: Active Mission Resolver Foundation.

Reason:

- It creates the missing architectural center without changing runtime behavior.
- It can be tested in isolation.
- It proves the key product rule: registry priority selects Build Week even when persisted state is stale.

## Cross-Phase Validation Before Completion

Before declaring the full fix complete:

```powershell
npm run build
node dist/mission/tests/ActiveMissionResolver.test.js
node dist/browser/tests/MissionBootstrapPolicy.test.js
node dist/browser/tests/NewConversationBootstrapRegression.test.js
node dist/mission/tests/BootstrapV2AcknowledgementValidation.test.js
node dist/graph/tests/RuntimeGraphIntelligence.test.js
node dist/mission/tests/BrowserContinuationCoordinator.test.js
```

Then run the broader compiled regression suite used by the project if available.

## Review Questions Before Implementation

1. Should old sessions without mission metadata always force bootstrap, or should there be a temporary compatibility exception when registry and state already match?
2. Should resolver `reconcile()` immediately mark the previous mission as `PAUSED` or leave its existing status untouched as historical state?
3. Should continuation files for stale missions be marked stale in-place, or only ignored by active continuation logic?
4. Should `MissionRegistry` expose source file paths for diagnostics, or is source precedence text enough for the first implementation?
5. Should Codex jobs require `metadata.missionId` immediately, or can Codex mission metadata be added after BrowserAgent/ChatGPT behavior is stable?
