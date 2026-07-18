# Mission Priority Verification

Date: 2026-07-18

## Scope

This verification covers the implemented Mission Priority system through Phase 3:

- `ActiveMissionResolver`
- explicit mission-state reconciliation
- mission-aware `MissionBootstrapPolicy`
- BrowserAgent startup integration
- session mission metadata persistence
- Mission Bootstrap acknowledgement session metadata

Out of scope for this verification:

- RuntimeGraphIntelligence changes
- Continuation changes
- Dashboard changes
- Codex Driver changes
- Multi-AI runtime changes

No new features were implemented during verification.

## Verification Method

Verification used isolated temporary repositories and fake BrowserAgent browser/runtime dependencies. The tests exercised the real compiled runtime classes:

- `BrowserAgentApp`
- `ActiveMissionResolver`
- `MissionRegistry`
- `MissionStateStore`
- `SessionStore`
- `MissionBootstrapPolicy`
- `createMissionAcknowledgementSessionPatch`

The real repository `.keynu` runtime files were not edited.

## Summary

All Mission Priority verification scenarios passed.

Phase 4 may begin after review, subject to the risks listed below.

## Scenario 1: Fresh Repository

### Setup

- Created an isolated temporary repository.
- Wrote only `config/missions/projects.json`.
- Configured active mission: `openai-build-week`.
- Wrote Build Week and React Dashboard mission definitions under `config/missions/keynu`.
- Did not create `.keynu/missions/state.json`.
- Did not create `.keynu/session/session.json`.
- Started `BrowserAgentApp` with fake browser/runtime dependencies.

### Expected Behavior

- `SessionStore.read()` creates a default fresh session.
- `ActiveMissionResolver.resolve()` selects `openai-build-week` from the configured registry.
- Missing persisted mission state requires reconciliation.
- Reconciliation creates active runtime state for `openai-build-week`.
- Bootstrap policy requires Mission Bootstrap.
- Generated bootstrap targets `openai-build-week`.
- Session mission metadata is persisted after bootstrap send.

### Observed Behavior

- Runtime state active mission became `openai-build-week`.
- One `MISSION_BOOTSTRAP` was sent.
- Sent bootstrap contained `openai-build-week`.
- Session stored `missionProjectId=keynu`, `missionId=openai-build-week`, bootstrap id, and memory revision.

### Pass/Fail

PASS

### Risks

- This used fake browser transport, not a live Playwright/Chrome session.
- Mission validation and browser rendering were not the focus of this scenario.

## Scenario 2: Fresh Session

### Setup

- Created isolated repository with local `.keynu/missions/projects.json`.
- Configured active mission: `openai-build-week`.
- Persisted mission state already matched `openai-build-week`.
- Did not create a session file.
- Started `BrowserAgentApp`.

### Expected Behavior

- Fresh session cannot suppress bootstrap.
- Resolver action is `NONE` because registry and state match.
- Bootstrap policy treats the missing prior conversation as `NEW_CONVERSATION`.
- One Build Week bootstrap is generated.

### Observed Behavior

- One Mission Bootstrap was sent.
- Session persisted Build Week mission metadata.
- Session stale reason was `NEW_CONVERSATION`.

### Pass/Fail

PASS

### Risks

- Fresh sessions will bootstrap even when mission state is already reconciled. This is intentional, but it can produce visible bootstrap messages in a new conversation.

## Scenario 3: Existing Restored Session

### Setup

- Created isolated repository with registry and state both selecting `openai-build-week`.
- Created session with:
  - same conversation URL
  - `memoryRestored=true`
  - `missionProjectId=keynu`
  - `missionId=openai-build-week`
  - matching bootstrap and memory revision metadata
- Started `BrowserAgentApp` with a mission preparer that would throw if bootstrap generation was attempted.

### Expected Behavior

- Resolver selects Build Week and requires no reconciliation.
- Bootstrap policy allows the restored session to suppress duplicate bootstrap.
- No bootstrap is generated.
- BrowserAgent still starts.

### Observed Behavior

- No bootstrap was sent.
- Session remained `memoryRestored=true`.
- Startup logged that the mission was already restored for the conversation.

### Pass/Fail

PASS

### Risks

- Current policy does not validate `missionAcknowledgedAt`; it relies on `memoryRestored` plus mission identity.

## Scenario 4: Stale Dashboard Mission

### Setup

- Created isolated repository where registry selects `openai-build-week`.
- Persisted state selected `react-mission-control-dashboard`.
- Session represented a restored browser conversation for the stale Dashboard mission.
- Started `BrowserAgentApp`.

### Expected Behavior

- Resolver selects `openai-build-week`.
- Resolver reports persisted-state mismatch.
- Explicit reconciliation updates active runtime state to Build Week.
- Historical Dashboard mission record remains preserved.
- Bootstrap policy requires Mission Bootstrap.
- Session mission metadata is rewritten to Build Week after bootstrap send.

### Observed Behavior

- Runtime state active mission became `openai-build-week`.
- Historical `react-mission-control-dashboard` state record remained present.
- One Build Week bootstrap was sent.
- Session stored `missionId=openai-build-week`.
- Session stale reason was `MISSION_RECONCILIATION_REQUIRED`.

### Pass/Fail

PASS

### Risks

- Historical stale mission records are preserved but not marked paused/stale. That is consistent with Phase 2/3 design, but Dashboard will need resolver diagnostics before displaying state safely.

## Scenario 5: Build Week Mission

### Setup

- Used registry active mission `openai-build-week`.
- Used both fresh and stale-state startup scenarios.
- Inspected generated bootstrap message.

### Expected Behavior

- Mission identity comes from `ActiveMissionResolver`.
- Bootstrap generation uses `resolvedMission.projectId`.
- BrowserAgentApp rejects any bootstrap payload that does not match the resolved mission.

### Observed Behavior

- Generated bootstrap contained `openai-build-week`.
- Fake `MissionManager.prepare()` received `projectId=keynu`.
- Bootstrap assertion passed.

### Pass/Fail

PASS

### Risks

- The production `MissionManager.prepare()` still internally uses `MissionRegistry`. It receives the resolved project id, and BrowserAgentApp asserts payload identity, but MissionManager itself is not yet fully resolver-owned.

## Scenario 6: Browser Restart

### Setup

- First startup used stale Dashboard state and sent a Build Week bootstrap.
- No Mission ACK was applied.
- Started a second `BrowserAgentApp` instance for the same conversation inside the pending window.
- Mission preparer was configured to throw if bootstrap generation was attempted.

### Expected Behavior

- First startup reconciles state and sends Build Week bootstrap.
- Second startup resolves Build Week with no state mismatch.
- Session contains pending Build Week bootstrap metadata.
- Pending bootstrap protection suppresses duplicate bootstrap.

### Observed Behavior

- First startup sent one Build Week bootstrap.
- Second startup sent no bootstrap.
- Startup logged that Mission Bootstrap was already sent and waiting for acknowledgement.
- Active state remained `openai-build-week`.

### Pass/Fail

PASS

### Risks

- Pending duplicate protection is time-window based. If ChatGPT never acknowledges and the window expires, a future startup can resend bootstrap by design.

## Scenario 7: Browser Reconnect

### Setup

- Created isolated repository with Build Week active state.
- Created session containing pending Build Week bootstrap metadata.
- Applied a Mission ACK session patch.
- Started a new `BrowserAgentApp` instance for the same conversation after the pending window.
- Mission preparer was configured to throw if bootstrap generation was attempted.

### Expected Behavior

- Resolver selects Build Week.
- Session mission identity matches resolved mission.
- `memoryRestored=true` from acknowledgement.
- Bootstrap policy skips bootstrap after reconnect.

### Observed Behavior

- No bootstrap was sent.
- Session remained `memoryRestored=true`.
- `missionAcknowledgedAt` remained persisted.
- Startup logged that the mission was already restored.

### Pass/Fail

PASS

### Risks

- Reconnect behavior currently depends on session metadata, not direct inspection of ChatGPT conversation contents.

## Scenario 8: Mission Acknowledgement

### Setup

- Created isolated session with a pending Build Week bootstrap.
- Applied `createMissionAcknowledgementSessionPatch()` using a Build Week `MISSION_ACK`.

### Expected Behavior

- Session should persist:
  - `missionProjectId`
  - `missionId`
  - `missionBootstrapId`
  - `missionAcknowledgedAt`
  - `missionMemoryRevision`
- Session should set `memoryRestored=true`.
- Session stale reason should be cleared.

### Observed Behavior

- `memoryRestored=true`.
- `missionProjectId=keynu`.
- `missionId=openai-build-week`.
- `missionBootstrapId=mission-bootstrap-keynu-openai-build-week-verification`.
- `missionMemoryRevision=revision-verification`.
- `missionAcknowledgedAt=2026-07-18T08:01:00.000Z`.
- `missionRestorationStaleReason` was cleared.

### Pass/Fail

PASS

### Risks

- The verification used the exported acknowledgement patch helper. Full live watcher acknowledgement delivery was not run because it would require a live browser conversation.

## Scenario 9: Repeated Startup

### Setup

- Ran startup once in a stale Dashboard state scenario.
- Reused the same isolated session and state files.
- Ran startup again for the same conversation.

### Expected Behavior

- First startup reconciles and sends Build Week bootstrap.
- Second startup must not re-reconcile unnecessarily.
- Second startup must not send duplicate bootstrap while pending metadata is valid.

### Observed Behavior

- First startup sent one bootstrap.
- Active mission remained `openai-build-week`.
- Second startup sent no bootstrap.
- Mission preparer was not called on second startup.

### Pass/Fail

PASS

### Risks

- Repeated startup after pending-window expiry but before acknowledgement can resend bootstrap. That is existing duplicate-window policy, not a verifier failure.

## Scenario 10: Duplicate Bootstrap Prevention

### Setup

- Used same-conversation session with:
  - `memoryRestored=false`
  - `missionProjectId=keynu`
  - `missionId=openai-build-week`
  - `missionBootstrapSentAt` inside the pending window
  - matching `missionBootstrapConversationUrl`
- Resolver output matched Build Week and action `NONE`.

### Expected Behavior

- `MissionBootstrapPolicy` reports `bootstrapPending=true`.
- BrowserAgent startup skips bootstrap generation.
- The pending bootstrap must not suppress a different mission, but can suppress the same mission.

### Observed Behavior

- Policy and BrowserAgent integration tests both skipped duplicate bootstrap for matching Build Week pending metadata.
- Phase 2 policy tests verify pending bootstrap for another mission does not suppress the resolved Build Week bootstrap.

### Pass/Fail

PASS

### Risks

- Pending protection is mission-aware but not bootstrap-id-aware in the policy decision. It depends on mission identity, conversation, timestamp window, and memory revision when provided.

## Commands Run

Focused verification tests:

```powershell
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\mission\tests\ActiveMissionResolver.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\browser\tests\MissionBootstrapPolicy.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\browser\tests\BrowserAgentMissionStartupIntegration.test.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' dist\session\tests\SessionStoreCompatibility.test.js
```

Result: passed.

Additional isolated end-to-end verification script:

```powershell
@' ... verification script ... '@ | & 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --input-type=module -
```

Result: passed for:

- fresh repository with config registry and no state/session
- fresh session with existing Build Week state
- existing restored matching session
- stale Dashboard state with restored session
- pending-bootstrap browser restart
- acknowledged browser reconnect

Literal build command:

```powershell
npm run build
```

Result: failed because `npm` is not on the PowerShell `PATH`.

Equivalent build commands using the local Codex Node runtime:

```powershell
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\typescript\bin\tsc
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\esbuild\bin\esbuild src\app\graph3d\graph3dClient.ts --bundle --format=esm --platform=browser --target=es2022 --outfile=dist\app\public\graph3dClient.js
& 'C:\Users\aminn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vite\bin\vite.js build --config apps\mission-control\vite.config.ts
```

Result: passed.

## Non-Blocking Observations

- A previous full mission-test sweep stopped at `BrowserContinuationCoordinator.test.js` because it expected `Autonomous Step: 4/12` and observed `5/12`. Continuation is explicitly out of scope for this verification and was not changed.
- RuntimeGraphIntelligence still reads mission state directly and remains scheduled for Phase 4 or later.
- Dashboard still needs resolver diagnostics before it can safely display mission priority.

## Final Result

Mission Priority verification passed for all required scenarios.

No Mission Priority defect was found during this verification pass.
