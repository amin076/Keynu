# Mission Priority Root-Cause Analysis

Date: 2026-07-18

## Summary

The mission priority conflict is caused by multiple active-mission sources with no canonical resolver or invalidation rule.

The repository and local project registries now select `openai-build-week`, but `.keynu/missions/state.json` still persists `react-mission-control-dashboard` as the runtime active mission. Mission Bootstrap generation would select Build Week if a new bootstrap is generated. However, BrowserAgent startup can skip bootstrap based only on session conversation state, and some runtime/dashboard consumers read `.keynu/missions/state.json` directly. That allows stale React Mission Control runtime state to keep appearing as active and to influence runtime surfaces even after the mission registry changed.

This is a bug in architecture/state ownership, not an intentional product rule.

## Execution Flow Diagram

### BrowserAgent Startup to Mission Bootstrap

```text
npm run browser-agent
  -> node dist/browser/runBrowserAgent.js
    -> SessionStore.read()
       reads .keynu/session/session.json
    -> resolve conversationUrl from env or session
    -> new BrowserAgentApp({ conversationUrl }).start()
      -> SessionStore.read()
         reads .keynu/session/session.json again
      -> decideMissionBootstrap(previousSession, conversationUrl)
         uses only:
           - previous session conversationUrl
           - previous session memoryRestored
           - previous session missionBootstrapSentAt
           - previous session missionBootstrapConversationUrl
      -> SessionStore.patch(...)
         writes .keynu/session/session.json
      -> registerBuiltinDrivers(...)
      -> BrowserDriver.initialize()
      -> BrowserAgent.seedWatcherBaseline()
      -> if shouldRestoreMission:
           sendMissionBootstrap()
             -> new MissionManager()
             -> MissionManager.prepareMessage()
               -> MissionManager.prepare()
                 -> MissionRegistry.getActiveMission()
                   -> MissionRegistry.loadRegistry()
                     chooses first existing registry:
                       1. .keynu/missions/projects.json
                       2. config/missions/projects.json
                   -> activeMissionId from registry: openai-build-week
                   -> MissionRegistry.loadMission()
                     chooses first existing mission definition:
                       1. .keynu/missions/<project>/<mission>.json
                       2. config/missions/<project>/<mission>.json
                     -> openai-build-week exists under config
                 -> MissionStateStore.setActiveMission(openai-build-week)
                    writes .keynu/missions/state.json
                 -> ContextAssembler.assemble()
                    reads active mission from MissionRegistry again
                    reads .keynu/memory/*
                    reads .keynu/missions/state.json mission entry for the selected mission only
                 -> BootstrapBuilder.build()
                    repeats context assembly
                    calculates memory revision
                    MissionStateStore.setActiveMission(openai-build-week)
                    MissionStateStore.recordBootstrap(openai-build-week)
                    returns KAP MISSION_BOOTSTRAP
             -> Browser conversation sends bootstrap
             -> SessionStore.patch(missionBootstrapSentAt...)
      -> else:
           log "Mission already restored" or "bootstrap already sent"
           no MissionManager.prepare()
           no MissionStateStore.setActiveMission()
           stale .keynu/missions/state.json remains unchanged
      -> BrowserAgent.start()
         watches ChatGPT for KAP messages
```

### Runtime Consumers After Startup

```text
BrowserAgent job continuation
  -> MissionManager.getStatus()
    -> MissionRegistry.getActiveMission()
    -> Build Week is selected from project registry

Dashboard /api/status
  -> MissionManager.getStatus()
    -> MissionRegistry.getActiveMission()
    -> Build Week is selected from project registry

RuntimeGraphIntelligence
  -> readJson(.keynu/missions/state.json)
  -> activeMissionId = state.activeMissionId
  -> React Mission Control is selected from stale persisted state

Continuation delivery records
  -> existing files under .keynu/missions/continuations and continuation-deliveries
  -> many persisted React Mission Control records remain
```

## Direct Answers

### 1. Which File Is Loaded First?

For `npm run browser-agent`, the first repository state file read by the active runtime entry point is:

```text
.keynu/session/session.json
```

Evidence:

- `src/browser/runBrowserAgent.ts` creates `SessionStore` and calls `sessionStore.read()` before constructing `BrowserAgentApp`.
- `SessionStore.read()` resolves `.keynu/session/session.json`.

Important nuance: TypeScript/JavaScript modules are imported first by Node, but the first active repository state read in the startup logic is the session file.

### 2. Which Component Selects the Active Mission?

Mission selection for bootstrap generation is performed by:

```text
MissionRegistry.getActiveMission()
```

It is called by:

- `MissionManager.prepare()`
- `ContextAssembler.assemble()`
- `MissionManager.getStatus()`
- `MissionManager.recordJob()`
- `MissionManager.pause()/resume()/complete()`

`MissionRegistry` selects the active mission from the first existing project registry:

1. `.keynu/missions/projects.json`
2. `config/missions/projects.json`

Both currently point to:

```text
openai-build-week
```

So, if Mission Bootstrap is generated now, the selected mission should be Build Week.

### 3. Why Does state.json Override the Build Week Priority?

Strictly for Mission Bootstrap generation, `.keynu/missions/state.json` does not override Build Week. `MissionRegistry` selects Build Week from the project registry, and `MissionManager.prepare()` then writes that selection into `MissionStateStore`.

The apparent override happens because stale runtime state is still treated as authoritative by some paths:

1. BrowserAgent startup can skip `MissionManager.prepare()` entirely when `MissionBootstrapPolicy` decides the current conversation is already restored or bootstrap is pending.
2. When bootstrap is skipped, `MissionStateStore.setActiveMission()` is not called.
3. Therefore `.keynu/missions/state.json` remains at the old active mission.
4. Components such as `RuntimeGraphIntelligence` read `.keynu/missions/state.json.activeMissionId` directly and therefore report `react-mission-control-dashboard`.
5. Persisted continuation files also remain under the React mission and can make the old mission look operationally active.

So the issue is not that `MissionRegistry` chooses the wrong mission. The issue is that mission registry selection and runtime state selection are not reconciled on startup.

### 4. Is This Intentional or a Bug?

The individual design choices are intentional:

- Persisting mission runtime state is intentional.
- Keeping local `.keynu` mission registry ahead of repository config is intentional.
- Skipping duplicate bootstraps in the same conversation is intentional.
- Reading `.keynu/missions/state.json` for runtime graph intelligence is intentional.

The combined behavior is a bug:

- A mission priority change in the registry does not invalidate session restoration.
- A mission priority change does not force reconciliation of `.keynu/missions/state.json`.
- Runtime consumers can read stale `state.activeMissionId` without checking the registry.
- There is no canonical Active Mission Resolver defining precedence, freshness, and repair behavior.

The Build Week mission file itself anticipates part of this risk in its known limitations: local mission registry can override repository registry and must be synchronized before reconnecting BrowserAgent. In the current repo, both registries are synchronized, but `state.json` is not.

### 5. Which Component Is Responsible?

There is no `MissionBootstrapService` or `ActiveMissionResolver` in the current source. The concrete components are:

| Component | Role | Responsibility in conflict |
| --- | --- | --- |
| `BrowserAgentApp` | Starts BrowserAgent, applies bootstrap policy, sends bootstrap when required | It only asks for mission bootstrap when session policy says so. It does not reconcile active mission state before deciding to skip bootstrap. |
| `MissionBootstrapPolicy` | Decides whether to restore mission into ChatGPT | It uses only session/conversation fields. It does not consider active mission id, memory revision, mission revision, or `state.json` mismatch. |
| `MissionRegistry` | Selects configured active mission | It correctly selects `openai-build-week` from project registries. It is not the source of the stale React state. |
| `MissionManager` | Coordinates selection, bootstrap, status, acknowledgement, job records | On `prepare()`, it correctly writes active mission into `MissionStateStore`. But it is not invoked when bootstrap is skipped. |
| `MissionStateStore` | Persists runtime mission state | It preserves stale state until some caller updates it. It does not independently know the registry changed. |
| `BootstrapBuilder` | Builds KAP bootstrap and records bootstrap metadata | It would correctly set active mission to Build Week if called. |
| `RuntimeGraphIntelligence` | Creates graph/runtime mission snapshot | It reads `.keynu/missions/state.json` directly and can report stale `activeMissionId`. |
| `BrowserContinuationCoordinator` | Sends AI continuation requests after reports | It calls `MissionManager.getStatus()` for completion policy, but records continuation for the mission id passed by BrowserAgent. Existing React continuation files remain from earlier runs. |

Architectural responsibility belongs to the missing resolver/reconciliation layer, not to one file.

### 6. Do Multiple Sources of Truth Currently Exist?

Yes.

Current active-mission sources are:

1. `.keynu/missions/projects.json`
   - Local project registry.
   - Selected first by `MissionRegistry`.
   - Currently says `openai-build-week`.

2. `config/missions/projects.json`
   - Repository project registry fallback.
   - Currently says `openai-build-week`.

3. `.keynu/missions/state.json`
   - Runtime state store.
   - Currently says `react-mission-control-dashboard`.

4. `.keynu/session/session.json`
   - Conversation restoration state.
   - Does not store active mission id, bootstrap id, or memory revision as first-class current-session fields.
   - Can cause bootstrap to be skipped without checking whether the active mission changed.

5. `.keynu/missions/continuations/*.json` and `.keynu/missions/continuation-deliveries/*.json`
   - Continuation state and delivery state.
   - Existing React Mission Control records remain and can preserve old autonomous continuation context.

6. Mission definition files:
   - `.keynu/missions/keynu/*.json`
   - `config/missions/keynu/*.json`
   - Build Week exists only in `config/missions/keynu/openai-build-week.json`.
   - React Mission Control exists in `.keynu/missions/keynu/react-mission-control-dashboard.json`.

Only one of these should be the source of mission priority. The current code treats different ones as authoritative in different contexts.

## Evidence

### Registry Selects Build Week

`.keynu/missions/projects.json`:

```json
"activeMissionId": "openai-build-week"
```

`config/missions/projects.json`:

```json
"activeMissionId": "openai-build-week"
```

`MissionRegistry.loadRegistry()` checks local registry first, then repository registry. `MissionRegistry.getActiveMission()` uses `project.activeMissionId` from that registry and loads the matching mission definition.

### Runtime State Still Selects React Mission Control

`.keynu/missions/state.json`:

```json
"activeMissionId": "react-mission-control-dashboard"
```

The same file contains `react-mission-control-dashboard` with:

```json
"status": "ACTIVE",
"lastAssistantAcknowledged": true,
"currentMilestone": "React dashboard architecture and application shell"
```

### BrowserAgent Startup Is Session-Gated

`BrowserAgentApp.start()` reads session state, calls `decideMissionBootstrap()`, and only calls `sendMissionBootstrap()` when `shouldRestoreMission` is true.

`MissionBootstrapPolicy` computes `shouldRestoreMission` from:

- same conversation or new conversation
- `memoryRestored`
- pending bootstrap timestamp and conversation URL

It does not compare:

- registry active mission id
- `state.json.activeMissionId`
- active mission definition revision
- memory revision
- acknowledged bootstrap mission id
- acknowledged bootstrap memory revision

### MissionManager Would Correct the State If Invoked

`MissionManager.prepare()` calls:

```text
registry.getActiveMission()
stateStore.setActiveMission(...)
```

`BootstrapBuilder.build()` also calls:

```text
stateStore.setActiveMission(...)
stateStore.recordBootstrap(...)
```

So the stale state survives only when that path is not invoked after the registry priority changes.

### RuntimeGraphIntelligence Reads State Directly

`RuntimeGraphIntelligence.createSnapshot()` reads `.keynu/missions/state.json` and sets:

```text
activeMissionId = missionState.activeMissionId
```

It does not use `MissionRegistry` or `MissionManager.getStatus()`.

## Root Cause

The root cause is a missing canonical active-mission resolution contract.

Keynu currently has two different concepts using similar names:

1. Configured active mission:
   - Chosen from mission project registry.
   - Represents intended product priority.
   - Currently `openai-build-week`.

2. Persisted runtime active mission:
   - Stored in `.keynu/missions/state.json`.
   - Represents last mission that the runtime bootstrapped or recorded.
   - Currently `react-mission-control-dashboard`.

The code has no central component that:

- compares configured active mission with persisted active mission,
- decides which wins,
- records why,
- updates stale runtime state,
- invalidates old session bootstrap state,
- suppresses obsolete continuations,
- exposes a consistent active mission to BrowserAgent, Dashboard, graph intelligence, and continuation.

Because that resolver is missing, each subsystem picks the state source that is convenient:

- Bootstrap generation uses `MissionRegistry`.
- Graph intelligence uses `.keynu/missions/state.json`.
- Browser startup uses `.keynu/session/session.json` to decide whether to bootstrap at all.
- Continuation persistence stores mission-specific files separately.

That is why a lower-priority old mission can survive after project registries have moved to Build Week.

## Recommended Architecture

### 1. Introduce an Active Mission Resolver

Create a single resolver responsible for active mission selection and reconciliation.

Conceptual API:

```ts
type ActiveMissionResolution = {
  projectId: string;
  missionId: string;
  source: "registry";
  runtimeStateMissionId?: string;
  sessionMissionId?: string;
  mismatch: boolean;
  action: "none" | "reconcile_state" | "require_bootstrap" | "block";
  reason: string;
};
```

The resolver should be the only component allowed to answer "what is the active mission?"

### 2. Make Registry the Priority Source

Mission priority should come from the project registry:

1. `.keynu/missions/projects.json`
2. `config/missions/projects.json`

The state store should persist runtime lifecycle for the resolved mission, not select priority independently.

### 3. Reconcile Runtime State on BrowserAgent Startup

Before `decideMissionBootstrap()` is allowed to skip bootstrap, BrowserAgent startup should resolve active mission and compare:

- resolved registry mission id,
- `.keynu/missions/state.json.activeMissionId`,
- session acknowledged mission id,
- session acknowledged memory revision or bootstrap revision once available.

If they differ, startup should:

- mark memory/session restoration stale,
- set or migrate runtime active mission to the resolved mission,
- require a fresh Mission Bootstrap,
- leave old mission records intact but inactive.

### 4. Store Mission Identity in Session

`.keynu/session/session.json` should include current bootstrap/session mission metadata:

- `missionId`
- `projectId`
- `bootstrapId`
- `memoryRevision`
- `missionRevision`
- `missionAcknowledgedAt`
- `conversationUrl`

Then `MissionBootstrapPolicy` can reject stale restoration when the mission changes.

### 5. Stop Direct State Reads for Active Mission

Consumers such as `RuntimeGraphIntelligence` should receive active mission through the resolver or `MissionManager`, not by reading `state.activeMissionId` directly. They may still read persisted state as evidence, but not as the priority authority.

### 6. Treat Old Continuations as Mission-Scoped History

Continuation files for React Mission Control should remain as history, but they must not be treated as active unless their mission id matches the resolved active mission and the mission is not paused/completed/stale.

### 7. Add Conflict Diagnostics

Dashboard and BrowserAgent startup should expose a diagnostic when registry and state disagree:

```text
Configured active mission: openai-build-week
Persisted runtime active mission: react-mission-control-dashboard
Resolution: registry wins, runtime state requires reconciliation
```

That is safer than silently choosing whichever file a subsystem happened to read.

## Conclusion

The Build Week priority is correctly configured in the mission registries. The stale React Mission Control active state survives because persisted runtime state and session bootstrap policy are not invalidated when the configured active mission changes.

Mission Bootstrap generation itself would select Build Week if it runs. The defect is that BrowserAgent can skip the generation path based on session state, and other consumers can read stale runtime state directly.

The fix should not be a one-off edit to `state.json`. The correct fix is to define one active-mission resolution path, make registry priority authoritative, reconcile runtime state on startup, and require a new bootstrap when mission identity or memory revision changes.
