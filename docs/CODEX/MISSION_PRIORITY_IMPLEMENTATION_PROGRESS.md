# Mission Priority Implementation Progress

Date: 2026-07-18

## Phase 1: ActiveMissionResolver

Status: Completed for review.

## Files Changed

Created:

- `src/mission/ActiveMissionResolver.ts`
- `src/mission/tests/ActiveMissionResolver.test.ts`
- `docs/CODEX/MISSION_PRIORITY_IMPLEMENTATION_PROGRESS.md`

No BrowserAgent, MissionBootstrapPolicy, RuntimeGraphIntelligence, continuation, mission-state, or session integration was changed in Phase 1.

## Architecture Deviations

None intentional.

One Phase 1 scoping decision: the resolver currently implements `resolve()` only. It does not implement `reconcile()` yet because Phase 1 is intended to produce deterministic resolution and diagnostics without changing runtime behavior or writing persisted state. Reconciliation remains a future integration phase.

## Design Decisions

- `MissionRegistry` remains the configured mission-priority source.
- `MissionStateStore` is read only as persisted runtime evidence.
- Registry/state match returns action `NONE`.
- Missing persisted active state returns action `RECONCILE_STATE`.
- Registry/state mismatch returns action `REQUIRE_BOOTSTRAP`, with `stateMismatch=true` and `requiresBootstrap=true`.
- Missing mission definitions and invalid registries return action `BLOCKED`.
- The resolver catches registry/state read failures and returns deterministic blocked diagnostics instead of throwing.
- Tests use isolated temporary repositories and never read or write the real `.keynu` directory.

## Unresolved Questions

- Phase 2 should decide whether `reconcile()` should write state directly or return a patch/apply plan first.
- Phase 2 should decide how session mission metadata is represented and whether legacy sessions without mission metadata always force bootstrap.
- A future phase should decide whether stale previous mission records are left untouched or marked `PAUSED`/stale during reconciliation.
- A future phase should decide whether `MissionRegistry` needs to expose actual source file paths for diagnostics.

## Test Results

Literal command requested:

```powershell
npm run build
```

Result: failed in this shell because `npm` is not on the PowerShell `PATH`.

Equivalent build steps run with the local Codex Node runtime:

```powershell
node node_modules/typescript/bin/tsc
node node_modules/esbuild/bin/esbuild src/app/graph3d/graph3dClient.ts --bundle --format=esm --platform=browser --target=es2022 --outfile=dist/app/public/graph3dClient.js
node node_modules/vite/bin/vite.js build --config apps/mission-control/vite.config.ts
```

Result: passed.

New resolver test:

```powershell
node dist/mission/tests/ActiveMissionResolver.test.js
```

Result: passed.

## Future Integration Points

- `MissionBootstrapPolicy` should receive the resolver output and refuse to skip bootstrap when the resolved mission differs from session metadata.
- `BrowserAgentApp` should run resolver/reconciliation before bootstrap policy.
- `MissionManager` should use the same active-mission resolution path for `prepare()`, `getStatus()`, and job recording.
- `RuntimeGraphIntelligence` should use resolver output for active mission identity instead of reading `state.activeMissionId` as authoritative.
- `BrowserContinuationCoordinator` should gate implicit continuation by the resolved active mission.
- Dashboard/API diagnostics should surface configured mission, persisted mission, resolver action, and mismatch reasons.

## Phase 2: Mission Reconciliation and Bootstrap Policy

Status: Completed for review.

### Phase 1 Review

- `ActiveMissionResolver.resolve()` remains side-effect free.
- Configured mission priority from `MissionRegistry` still wins over stale persisted state.
- Resolver diagnostics expose configured and persisted mission identities.
- Resolver tests still use isolated temporary repositories and never touch the real `.keynu` runtime directory.

### Files Created

- `src/session/tests/SessionStoreCompatibility.test.ts`

### Files Modified

- `src/mission/ActiveMissionResolver.ts`
- `src/mission/tests/ActiveMissionResolver.test.ts`
- `src/browser/MissionBootstrapPolicy.ts`
- `src/browser/tests/MissionBootstrapPolicy.test.ts`
- `src/session/sessionTypes.ts`
- `docs/CODEX/MISSION_PRIORITY_IMPLEMENTATION_PROGRESS.md`

### Reconciliation API Chosen

- `buildReconciliationPlan(resolution?)` is pure and returns whether persisted mission state should be reconciled.
- `reconcile(options?)` is explicit and is the only new resolver method that writes mission state.
- Reconciliation uses `MissionStateStore.setActiveMission()` to set the configured registry mission as active.
- Existing mission records are preserved.
- Repeated reconciliation is idempotent: once state matches configured mission priority, a second call reports `stateChanged=false`.

### Policy Changes

- `MissionBootstrapPolicy` now has a mission-aware input shape that accepts resolver output plus session data.
- The legacy call signature remains available for current BrowserAgent startup code.
- A restored session can skip bootstrap only when it matches the resolved mission identity.
- A session with no mission identity is treated as mission-unknown and cannot suppress bootstrap.
- A session for another mission cannot suppress bootstrap.
- Resolver actions `RECONCILE_STATE` and `REQUIRE_BOOTSTRAP`, or `stateMismatch=true`, require bootstrap.
- Pending bootstrap protection applies only when the pending bootstrap belongs to the same resolved mission.

### Session Compatibility Behavior

- Added optional session metadata fields:
  - `missionProjectId`
  - `missionId`
  - `missionBootstrapId`
  - `missionMemoryRevision`
  - `missionRestorationStaleReason`
- Existing session files without these fields still load successfully.
- Old sessions without mission metadata are considered mission-unknown by the mission-aware bootstrap policy.

### Tests Added or Updated

- `ActiveMissionResolver.test.ts`
  - explicit reconciliation preserves historical mission records.
  - repeated reconciliation is idempotent.
- `MissionBootstrapPolicy.test.ts`
  - restored session with matching mission may skip bootstrap.
  - restored session with unknown mission requires bootstrap.
  - restored session with different mission requires bootstrap.
  - registry Build Week plus persisted Dashboard requires reconciliation/bootstrap.
  - pending bootstrap for matching mission remains protected.
  - pending bootstrap for different mission requires bootstrap.
- `SessionStoreCompatibility.test.ts`
  - legacy session JSON without mission metadata loads successfully.

### Validation Commands

Literal command requested:

```powershell
npm run build
```

Result: failed in this shell because `npm` is not on the PowerShell `PATH`.

Equivalent build commands run with the local Codex Node runtime:

```powershell
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\typescript\bin\tsc
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\esbuild\bin\esbuild src\app\graph3d\graph3dClient.ts --bundle --format=esm --platform=browser --target=es2022 --outfile=dist\app\public\graph3dClient.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vite\bin\vite.js build --config apps\mission-control\vite.config.ts
```

Result: passed.

Focused tests:

```powershell
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\mission\tests\ActiveMissionResolver.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\browser\tests\MissionBootstrapPolicy.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\browser\tests\NewConversationBootstrapRegression.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\session\tests\SessionStoreCompatibility.test.js
```

Result: passed.

### Deviations from Approved Architecture

None intentional.

Phase 2 intentionally leaves BrowserAgent startup integration out of scope. The mission-aware policy API exists, but the current BrowserAgent call site still uses the backward-compatible legacy signature until Phase 3 wires in resolver output.

### Unresolved Risks

- BrowserAgent startup still does not invoke `ActiveMissionResolver.reconcile()`.
- Session mission metadata is not yet written by BrowserAgent after bootstrap send or acknowledgement.
- RuntimeGraphIntelligence still needs to consume the authoritative resolved mission identity in a later phase.
- Continuation logic still needs mission-aware stale-session gating in a later phase.

### Recommended Phase 3 Scope

- Wire BrowserAgent startup to resolve the active mission before bootstrap decisions.
- Explicitly apply reconciliation before building/sending Mission Bootstrap.
- Pass resolver output into `MissionBootstrapPolicy`.
- Persist mission session metadata when bootstrap is sent and when acknowledgement is recorded.
- Keep RuntimeGraphIntelligence and continuation integration for a separate follow-up unless the Phase 3 review expands scope.

## Phase 3: BrowserAgent Startup Integration

Status: Completed for review.

### Architecture Notes

- `BrowserAgentApp.start()` now loads the session before mission resolution.
- `ActiveMissionResolver.resolve()` runs before `MissionBootstrapPolicy`.
- If `buildReconciliationPlan()` reports required state reconciliation, BrowserAgent startup calls the explicit `reconcile()` API before bootstrap policy evaluation.
- `MissionBootstrapPolicy` receives the previous session, current conversation URL, and resolver output.
- Mission Bootstrap generation uses the resolved `projectId` and asserts the returned bootstrap payload matches the resolved `projectId`/`missionId`.
- BrowserAgent startup persists session mission metadata immediately after a successful bootstrap send.
- `BrowserAgent` persists mission metadata after a valid `MISSION_ACK`.
- RuntimeGraphIntelligence, Dashboard, continuation, Codex Driver, and multi-AI runtime were intentionally not changed.

### Files Created

- `src/browser/tests/BrowserAgentMissionStartupIntegration.test.ts`

### Files Modified

- `src/browser/BrowserAgentApp.ts`
- `src/browser/BrowserAgent.ts`
- `src/mission/MissionRegistry.ts`
- `docs/CODEX/MISSION_PRIORITY_IMPLEMENTATION_PROGRESS.md`

### Runtime Behavior

- A stale restored BrowserAgent session cannot skip bootstrap unless its session mission identity matches the resolver output.
- Stale persisted mission state is reconciled through `ActiveMissionResolver.reconcile()` before bootstrap decisions.
- The old React Mission Control mission can remain in historical mission records while `openai-build-week` becomes the active runtime mission.
- A second startup after sending the same Build Week bootstrap is protected by the mission-aware pending-bootstrap window and does not duplicate the bootstrap.
- `MISSION_ACK` session persistence now records:
  - `missionProjectId`
  - `missionId`
  - `missionBootstrapId`
  - `missionAcknowledgedAt`
  - `missionMemoryRevision`

### Compatibility and Safety Notes

- `BrowserAgentApp` production defaults still construct the same runtime, browser driver, BrowserAgent, MissionManager, SessionStore, and ActiveMissionResolver when dependencies are not injected.
- The dependency seams added to `BrowserAgentApp` are narrow and exist to test startup ordering without launching Playwright or initializing real drivers.
- `MissionRegistry` now tolerates a UTF-8 BOM while reading registry and mission JSON files. This avoids editing real `.keynu` runtime files and is required because the current local `.keynu/missions/projects.json` begins with a BOM.

### Tests Added or Updated

- `BrowserAgentMissionStartupIntegration.test.ts`
  - stale Dashboard state.
  - Build Week registry priority.
  - restored browser session.
  - explicit reconciliation before bootstrap generation.
  - bootstrap generated for Build Week.
  - second startup does not duplicate pending Build Week bootstrap.
  - mission acknowledgement persistence.

### Validation Commands

Literal command requested:

```powershell
npm run build
```

Result: failed in this shell because `npm` is not on the PowerShell `PATH`.

Equivalent build commands run with the local Codex Node runtime:

```powershell
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\typescript\bin\tsc
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\esbuild\bin\esbuild src\app\graph3d\graph3dClient.ts --bundle --format=esm --platform=browser --target=es2022 --outfile=dist\app\public\graph3dClient.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vite\bin\vite.js build --config apps\mission-control\vite.config.ts
```

Result: passed.

Focused tests:

```powershell
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\mission\tests\ActiveMissionResolver.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\browser\tests\MissionBootstrapPolicy.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\browser\tests\BrowserAgentMissionStartupIntegration.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\browser\tests\BrowserAgentBootstrapOrdering.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\session\tests\SessionStoreCompatibility.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\browser\tests\NewConversationBootstrapRegression.test.js
```

Result: passed.

All mission tests command:

```powershell
$tests = Get-ChildItem dist\mission\tests -Filter *.test.js | Sort-Object Name; foreach ($test in $tests) { & 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' $test.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

Result: failed at `BrowserContinuationCoordinator.test.js`.

Observed failure:

```text
Expected: /Autonomous Step: 4\/12/
Actual:   Autonomous Step: 5/12
```

Continuation behavior is out of scope for Phase 3 and was not changed.

### Deviations from Approved Architecture

No intentional architectural deviations.

One scoped compatibility fix was added: BOM-tolerant JSON loading in `MissionRegistry`. This is needed because BrowserAgent startup now depends on resolver/registry loading before policy evaluation, and the current local runtime registry file contains a BOM.

### Remaining Work

- Wire RuntimeGraphIntelligence to consume resolver output.
- Gate continuation against the resolved active mission.
- Surface resolver diagnostics in Dashboard/API status.
- Consider whether session `missionRestorationStaleReason` should be cleared after acknowledgement or retained as audit history.

## Phase 4: Runtime Graph and Continuation Mission Consistency

Status: Completed for review.

### Files Created

None.

### Files Modified

- `src/graph/RuntimeGraphIntelligence.ts`
- `src/graph/tests/RuntimeGraphIntelligence.test.ts`
- `src/mission/BrowserContinuationCoordinator.ts`
- `src/mission/tests/BrowserContinuationCoordinator.test.ts`
- `docs/CODEX/MISSION_PRIORITY_IMPLEMENTATION_PROGRESS.md`

### Graph Resolution Behavior

- `RuntimeGraphIntelligence` now obtains active mission identity from `ActiveMissionResolver`.
- `.keynu/missions/state.json.activeMissionId` is no longer treated as authoritative mission priority.
- `MissionStateStore` data remains lifecycle evidence for status, milestone, last job, runtime state, and historical mission summaries.
- Graph snapshot generation is read-only. It calls `resolve()` but does not call `reconcile()`.
- When registry and persisted state disagree, the graph active mission is the configured registry mission.
- Snapshot output now includes `missionResolution` diagnostics:
  - resolved project id
  - resolved mission id
  - resolver action
  - mismatch state
  - bootstrap requirement
  - persisted active ids
  - diagnostics
- Historical persisted mission records are exposed in `historicalMissions`.

### Continuation Gating Behavior

- `BrowserContinuationCoordinator` now resolves the active mission through `ActiveMissionResolver`.
- Implicit continuation is delivered only when the context mission id matches the resolved active mission.
- A stale continuation context for another mission returns `SKIPPED_POLICY` with `SKIPPED_NON_ACTIVE_MISSION`.
- Old continuation files are not deleted or rewritten when stale continuation is suppressed.
- Registry/state mismatch still resolves Build Week as active; stale Dashboard state cannot cause Dashboard continuation delivery.
- Terminal completed-state checks now use `MissionStateStore` lifecycle evidence for the resolved mission.
- Repeated continuation checks retain existing duplicate-delivery protection.

### Mismatch Diagnostics

- Runtime graph snapshots include resolver diagnostics in both `missionResolution.diagnostics` and `warnings` when state mismatch is detected.
- The Build Week vs Dashboard mismatch test verifies:
  - `activeMissionId=openai-build-week`
  - `persistedActiveMissionId=react-mission-control-dashboard`
  - action `REQUIRE_BOOTSTRAP`
  - warning text identifying the mismatch
  - Dashboard mission remains visible as historical mission data

### Tests Added or Updated

- `RuntimeGraphIntelligence.test.ts`
  - registry and state match
  - registry Build Week but state Dashboard
  - missing state
  - missing mission configuration
  - mismatch diagnostics
  - historical mission data preservation
- `BrowserContinuationCoordinator.test.ts`
  - active Build Week continuation is delivered
  - stale Dashboard continuation is suppressed
  - stale records remain on disk
  - no prior active continuation creates a valid continuation
  - explicit active mission match continues normally
  - repeated checks do not duplicate delivery
  - registry/state mismatch still selects Build Week

### Validation Commands

Focused tests:

```powershell
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\mission\tests\ActiveMissionResolver.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\browser\tests\BrowserAgentMissionStartupIntegration.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\browser\tests\MissionBootstrapPolicy.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\graph\tests\RuntimeGraphIntelligence.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\mission\tests\BrowserContinuationCoordinator.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\session\tests\SessionStoreCompatibility.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\browser\tests\BrowserAgentContinuationIntegration.test.js
```

Result: passed.

Literal build command:

```powershell
npm run build
```

Result: not executed because `npm` is not on the PowerShell `PATH`.

Equivalent build commands run with the local Codex Node runtime:

```powershell
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\typescript\bin\tsc
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\esbuild\bin\esbuild src\app\graph3d\graph3dClient.ts --bundle --format=esm --platform=browser --target=es2022 --outfile=dist\app\public\graph3dClient.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vite\bin\vite.js build --config apps\mission-control\vite.config.ts
```

Result: passed.

### Architecture Deviations

No intentional deviations.

One small implementation detail: `BrowserContinuationCoordinator` accepts an injected resolver and state store rather than a separate resolved-mission DTO. This keeps production behavior consistent with BrowserAgent startup while allowing isolated temporary-repository tests.

### Unresolved Risks

- `MissionManager.getStatus()` still has its own registry-based path and has not been made resolver-aware in this phase.
- Dashboard/API still do not surface the new graph resolution diagnostics.
- BrowserAgent job handling can still pass a stale `kap.metadata.missionId`; coordinator suppresses stale continuation, but broader KAP mission mismatch policy remains future work.
- Historical mission records are exposed as history, but not marked stale in-place.

### Recommended Phase 5 Scope

- Make `MissionManager` status and lifecycle methods resolver-aware so status, job recording, bootstrap, graph, and continuation all share the same active mission identity.
- Add Dashboard/API diagnostics for `missionResolution` after MissionManager status is aligned.
- Define explicit KAP mission mismatch policy for jobs whose metadata targets a non-active mission.
