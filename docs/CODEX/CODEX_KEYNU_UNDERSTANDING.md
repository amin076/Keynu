# Codex Keynu Understanding Report

Date: 2026-07-18

## 1. What Keynu Is

Keynu is a local AI runtime and orchestration project. Its larger platform architecture is described as KAOS, the Keynu AI Operating System: an event-driven operating layer that coordinates AI systems, local runtimes, drivers, repositories, applications, evidence, memory, and dashboard state.

The immediate product purpose is to let an AI such as ChatGPT or Codex participate in real local work without pretending it has executed anything. Keynu uses a structured protocol, KAP, to move from AI reasoning to runtime execution and back to evidence-bearing reports.

The current critical product priority is not generic dashboard expansion. The active repository mission config says the priority is preparing Keynu and the selected demonstration project for OpenAI Build Week before the July 21 submission deadline. That mission emphasizes demonstrating verified existing Keynu capabilities, using Codex materially, preserving evidence, and avoiding unrelated architecture or broad feature work unless it directly supports the submission.

## 2. Architecture and Execution Flow

The canonical architecture in repository memory is:

```text
ChatGPT -> BrowserAgent -> KAP Extractor -> KAP Router -> PowerShell Runtime -> Local Repo -> KAP Report -> ChatGPT
```

The broader KAOS book describes the desired runtime layering:

```text
AI connectors
  -> Runtime Orchestrator
  -> Runtime Scheduler
  -> Event Bus
  -> Runtime Services
  -> Drivers
  -> Applications
```

The implementation currently has both a legacy/general runtime path and a BrowserAgent KAP path.

The legacy `Agent` path starts Keynu, registers built-in drivers, starts the dashboard server, watches an inbox queue, and executes queued tasks through `Runtime` and `CommandBus`. The registered built-in DriverManager drivers I saw are filesystem, Dehlero, and Blender.

The BrowserAgent path is the more important current AI loop. `runBrowserAgent.ts` resolves the conversation URL from `KEYNU_CONVERSATION_URL` or `.keynu/session/session.json`, then starts `BrowserAgentApp`. `BrowserAgentApp` decides whether a mission bootstrap is needed, initializes built-in drivers and the runtime, connects a `BrowserDriver` to ChatGPT, seeds the watcher baseline, sends a mission bootstrap if required, and enters the BrowserAgent loop.

In the BrowserAgent loop:

1. `ConversationWatcher` waits for a new assistant message.
2. `KapExtractor` extracts the first valid fenced or balanced JSON KAP envelope.
3. `MISSION_ACK` envelopes are correlated against the active bootstrap through `MissionManager.acknowledge`.
4. `JOB` envelopes are deduplicated by job id.
5. Jobs with `payload.target` of `powershell` or `filesystem` go through `routeKapJob`.
6. Other jobs are adapted to the legacy task model and run through `Runtime.execute`.
7. Execution results are wrapped with verification data and certificates.
8. Reports are serialized for browser delivery and sent back to ChatGPT.
9. Completed jobs are recorded in `MissionManager`.
10. Browser continuation may persist a `WAITING_AI` state and send a `KEYNU_CONTINUATION_REQUEST`.

The direct KAP router supports `powershell`, `commands`, and `filesystem` targets. PowerShell jobs run through the PowerShell runtime adapter and write persisted reports under `.keynu/powershell/reports`. Filesystem jobs use a Node.js adapter with workspace path checks. Command jobs execute sequential `CommandSpec` entries and are fail-fast unless `continueOnError` or per-command `runAfterFailure` is set.

## 3. How the Main Pieces Interact

### ChatGPT and BrowserAgent

ChatGPT is currently a browser-based AI connector. BrowserAgent watches a ChatGPT conversation, extracts KAP envelopes from assistant messages, executes accepted jobs locally through Keynu runtime paths, and sends KAP reports back into the same conversation. BrowserAgent is intended to be a bridge, not the owner of business logic, although ADR-0009 notes it has historically accumulated too many responsibilities and should continue being decomposed.

### KAP

KAP is the provider-neutral JSON application protocol. It defines message meaning, not transport. Browser chat, files, HTTP, WebSocket, JSON-RPC, MCP, or another transport can carry KAP. The required envelope fields are `protocol`, `version`, `type`, `id`, `createdAt`, and `payload`.

Important KAP message types include `MISSION_BOOTSTRAP`, `MISSION_ACK`, `JOB`, `REPORT`, `ERROR`, `CONTROL`, terminal waiting/blocking/completion messages, and capabilities. The validator already supports metadata fields such as correlation id, reply target, trace id, mission id, workflow id, sequence, idempotency key, deadlines, retry policy, and chunk metadata.

### Runtime

`Runtime` executes a task as ordered steps through `CommandBus`. It returns structured `RuntimeExecutionResult` data including start/end times, per-step results, failure details, and status. For the KAP targets most relevant to current Keynu operation, execution often bypasses the generic DriverManager path and goes through the direct KAP router.

### Mission Engine and Continuation

Mission state restoration is built around `MissionManager`, `MissionRegistry`, `MissionStateStore`, `MemoryLoader`, `ProjectInspector`, `ContextAssembler`, `ContextBudgeter`, `MissionValidator`, and `BootstrapBuilder`.

Mission Bootstrap V2 adds a deterministic bootstrap id and memory revision. The bootstrap includes project, mission, memory, repository state, mission rules, recommended reading, known limitations, and required acknowledgement fields. `MissionManager.acknowledge` rejects acknowledgements that do not match the active bootstrap id, active memory revision, active mission, or current milestone.

The continuation engine is designed to prevent silent stopping. After a completed or failed report, BrowserAgent can call `BrowserContinuationCoordinator.continueAfterReport`. That records continuation state under `.keynu/missions/continuations/<mission-id>.json`, builds a deterministic continuation request from mission id, last job id, and next action, persists delivery state under `.keynu/missions/continuation-deliveries/<request-id>.json`, and sends `KEYNU_CONTINUATION_REQUEST` if policy permits. Delivery is deduplicated and bounded by retry limits.

### Repository Memory

Repository memory is a core design decision. Chat history is not authoritative. New AI conversations are expected to restore context from repository-managed files, especially `.keynu/memory/current_state.md`, `.keynu/memory/next_steps.md`, `.keynu/memory/decisions.md`, `.keynu/memory/architecture.md`, and `.keynu/memory/startup_prompt.md`.

Memory revision calculation hashes the ordered memory documents, active mission definition, and KAP version. Protected memory policy exists for `.keynu/memory` files. In the source I inspected, protection is enforced in the PowerShell file-ops write pipeline through `writePowerShellFile`; the older patch-oriented runtime has a separate direct-write implementation.

### Drivers

The documented architecture wants drivers to expose capabilities and never contain business logic. Built-in DriverManager registration currently covers FileSystem, Dehlero, and Blender plus capabilities for filesystem reads/writes, Dehlero ping/sendCommand, and Blender status. There are also PowerShell and Codex driver-related source files, but PowerShell KAP execution is currently routed through runtime adapters, and Codex appears to be a manual bridge rather than a registered built-in runtime driver.

### Mission Bootstrap

Mission bootstrap is the new-chat restoration mechanism. It is sent when BrowserAgent connects to a conversation that is not already restored or acknowledged. The bootstrap payload includes the active mission, repository memory, protocol guide, validation results, required acknowledgement format, bootstrap id, and memory revision. A valid `MISSION_ACK` must refer to the exact bootstrap id and memory revision.

### Mission Control

Mission Control has two forms in this repository:

- A Node dashboard server under `src/app` that exposes `/api/status`, graph APIs, reports, memory summaries, processes, drivers, git state, and static dashboard assets.
- A React Mission Control app under `apps/mission-control` with shell/navigation and typed API-client groundwork.

The Dashboard information architecture document defines an operational UI with Overview, Knowledge Graph, Timeline, Reports, Memory, Processes, Drivers, Repository, and Diagnostics. It also says server-derived state remains the source of truth and the 2D graph should be the default graph experience. However, Build Week config says this mission should not resume automatically unless it directly advances the competition demo.

## 4. Current Repository State and Active Priorities

Repository memory says the latest verified checkpoint is runtime graph recommendations integrated with runtime graph intelligence. The documented next milestone in `.keynu/memory/next_steps.md` is to surface runtime recommendations inside the Dashboard UI with filtering, acknowledgement, and graph-node navigation.

The mission files show a priority conflict:

- `.keynu/missions/projects.json` points project `keynu` to active mission `openai-build-week`.
- `config/missions/projects.json` also points project `keynu` to active mission `openai-build-week`.
- `config/missions/keynu/openai-build-week.json` defines OpenAI Build Week as active and highest priority.
- `.keynu/missions/state.json` still says `activeMissionId` is `react-mission-control-dashboard`, with an acknowledged React dashboard bootstrap from 2026-07-18.
- `.keynu/missions/continuations` and `.keynu/missions/continuation-deliveries` contain many React Mission Control continuation artifacts.

The active product priority should be OpenAI Build Week, not old autonomous React dashboard continuation. The Build Week mission says the immediate next actions are to synchronize local mission activation, audit verified Keynu capabilities, select one clear competition story, build and verify the minimum demo, and prepare submission assets.

Working tree status before this report showed untracked files under:

- `apps/mission-control/src/api/`
- `docs/DASHBOARD/`

I did not modify those files. I only created this report under `docs/CODEX/`.

## 5. Documents and Source Files Inspected

Key repository and package files:

- `package.json`
- `.keynu/session/session.json`
- `.keynu/missions/projects.json`
- `.keynu/missions/state.json`
- `config/missions/projects.json`
- `config/missions/keynu/openai-build-week.json`
- `config/missions/keynu/knowledge-graph-engine.json`
- `.keynu/missions/keynu/react-mission-control-dashboard.json`
- `.keynu/missions/keynu/knowledge-graph-engine.json`

Repository memory:

- `.keynu/memory/current_state.md`
- `.keynu/memory/next_steps.md`
- `.keynu/memory/decisions.md`
- `.keynu/memory/architecture.md`
- `.keynu/memory/startup_prompt.md` was located as an important memory file, but I did not need its full content for the final architecture findings.

Core docs and book:

- `docs/KEYNU_START_HERE.md`
- `docs/BOOK/README.md`
- `docs/BOOK/SUMMARY.md`
- `docs/BOOK/KEYNU_BOOK.md`
- `docs/BOOK/01_RUNTIME_OVERVIEW.md`
- `docs/BOOK/02_RUNTIME_ARCHITECTURE.md`
- `docs/BOOK/04_BROWSER_RUNTIME.md`
- `docs/BOOK/06_RUNTIME_ORCHESTRATOR.md`
- `docs/BOOK/07_DRIVER_SYSTEM.md`
- `docs/BOOK/08_RUNTIME_MEMORY.md`
- `docs/BOOK/09_AI_CONNECTORS.md`
- `docs/BOOK/10_DEVELOPMENT_PROTOCOL.md`
- `docs/BOOK/16_KEYNU_AGENT_PROTOCOL.md`

KAP and runtime protocol docs:

- `docs/KAP/KAP_PROTOCOL_V1.md`
- `docs/KAP/KAP_ARCHITECTURE_REQUIREMENTS.md`
- `src/kap/README.md`
- `docs/KEYNU_RUNTIME_CONTROL_PROTOCOL_V01.md`
- `docs/KEYNU_WORKFLOW_PROTOCOL_V01.md`

BrowserAgent and verification docs:

- `docs/KEYNU_BROWSER_AGENT_HELP_V01.md`
- `docs/KEYNU_BROWSER_AGENT_VERIFICATION_BRIDGE_FLOW.md`
- `docs/KEYNU_BROWSER_POWERSHELL_RUNTIME_V10.md`
- `docs/KEYNU_BROWSER_POWERSHELL_V11_V13.md`
- `docs/KEYNU_BROWSER_POWERSHELL_RUNTIME_NOTES.md`
- `src/verification/BrowserAgentVerificationFlow.md`

Mission Engine and continuation docs:

- `docs/KEYNU_MISSION_MANAGER_ARCHITECTURE.md`
- `docs/keynu-book/MISSION_STATE_MACHINE.md`
- `docs/keynu-book/MISSION_CONTINUATION_ENGINE.md`
- `docs/keynu-book/CONTINUATION_PERSISTENCE.md`
- `docs/keynu-book/CONTINUATION_DELIVERY.md`
- `docs/keynu-book/BROWSER_CONTINUATION_COORDINATOR.md`
- `docs/keynu-book/BROWSER_AGENT_AUTONOMOUS_CONTINUATION.md`
- `docs/keynu-book/AI_CONTINUATION_REQUEST.md`

Architecture, dashboard, graph, memory, and driver docs:

- `docs/ADR/ADR-001-Repository-Memory.md`
- `docs/ADR/ADR-002-Protected-Repository-Memory.md`
- `docs/ADR/ADR-0012-MISSION-BOOTSTRAP-V2.md`
- `docs/ADR/ADR-0009-BROWSER-AGENT-DECOMPOSITION.md`
- `docs/DASHBOARD/REACT_MISSION_CONTROL_INFORMATION_ARCHITECTURE.md`
- `docs/KEYNU_KNOWLEDGE_GRAPH_ENGINE_FOUNDATION.md`
- `docs/keynu-book/RUNTIME_GRAPH_INTELLIGENCE.md`
- `docs/DEVELOPMENT/DRIVER_CAPABILITY_SYSTEM_V01.md`
- `docs/DEVELOPMENT/RUNTIME_MEMORY_SYSTEM_V01.md`
- `docs/KAOS/README.md`
- `docs/KAOS/KAOS-000-Platform-Vision.md`
- `docs/KAOS/KAOS-003-Driver-SDK.md`
- `docs/KAOS/KAOS-004-Mission-Control.md`
- `docs/KAOS/KAOS-005-Memory-System.md`
- `docs/KAOS/KAOS-017-KAP-Job-Router.md`

Source files inspected:

- `src/index.ts`
- `src/core/Agent.ts`
- `src/core/Runtime.ts`
- `src/core/CommandBus.ts`
- `src/core/CapabilityRegistry.ts`
- `src/core/DriverManager.ts`
- `src/core/registerBuiltinDrivers.ts`
- `src/browser/BrowserAgent.ts`
- `src/browser/BrowserAgentApp.ts`
- `src/browser/runBrowserAgent.ts`
- `src/browser/kap-browser-runtime-bridge.ts`
- `src/browser/browser-agent-runtime-hook.ts`
- `src/kap/KapExtractor.ts`
- `src/kap/KapEnvelope.ts`
- `src/kap/KapValidator.ts`
- `src/kap/KapReport.ts`
- `src/runtime/kap-job-router.ts`
- `src/runtime/kap-router-cli.ts`
- `src/mission/MissionManager.ts`
- `src/mission/MissionRegistry.ts`
- `src/mission/MissionStateStore.ts`
- `src/mission/BootstrapBuilder.ts`
- `src/mission/MemoryLoader.ts`
- `src/mission/MemoryRevisionCalculator.ts`
- `src/mission/ContextAssembler.ts`
- `src/mission/ProjectInspector.ts`
- `src/mission/BrowserContinuationCoordinator.ts`
- `src/mission/ContinuationRequestBuilder.ts`
- `src/mission/ContinuationStore.ts`
- `src/mission/ContinuationDeliveryService.ts`
- `src/memory/ProtectedMemoryPolicy.ts`
- `src/drivers/powershell/powershell-runtime-adapter.ts`
- `src/drivers/powershell/powershell-runtime.ts`
- `src/drivers/powershell/powershell-fileops.ts`
- `src/drivers/powershell/powershell-patch.ts`
- `src/drivers/powershell/powershell-runner.ts`
- `src/drivers/powershell/PowerShellDriver.ts`
- `src/drivers/filesystem/filesystem-runtime-adapter.ts`
- `src/drivers/filesystem/FileSystemDriver.ts`
- `src/drivers/codex/CodexDriver.ts`
- `src/app/dashboardServer.ts`
- `src/app/dashboardApi.ts`
- `apps/mission-control/src/App.tsx`
- `apps/mission-control/src/components/AppShell.tsx`
- `apps/mission-control/src/api/contracts.ts`
- `apps/mission-control/src/api/httpClient.ts`

## 6. Contradictions and Stale Information

1. The active mission state is contradictory. Local and repository project registries point to `openai-build-week`, but `.keynu/missions/state.json` still marks `react-mission-control-dashboard` as the active mission and contains a recent acknowledged React dashboard bootstrap.

2. `docs/KEYNU_START_HERE.md` is stale for the current priority. It says new chats should continue "Dashboard Mission Control v07/v08", but Build Week config says OpenAI Build Week is the highest-priority active mission and general dashboard work must not resume unless it directly supports the competition demo.

3. `.keynu/memory/next_steps.md` still points to Dashboard recommendation UI as the next milestone. That may remain technically accurate for the graph-intelligence checkpoint, but it conflicts with the Build Week mission's product priority.

4. The architecture docs describe PowerShell, Browser, Codex, and other drivers as part of the driver ecosystem, but `registerBuiltinDrivers.ts` currently registers only FileSystem, Dehlero, and Blender in DriverManager. PowerShell is active through direct KAP router adapters rather than the built-in DriverManager list; Codex source exists as a manual bridge but is not registered as a built-in driver.

5. ADR-0012 says Mission Bootstrap V2 is "Proposed", but significant pieces appear implemented in source, including bootstrap id, memory revision, correlated acknowledgement validation, and state persistence. The status label is stale relative to implementation.

6. Protected repository memory is documented as integrated into the PowerShell runtime write pipeline. I verified this in the PowerShell file-ops path through `powershell-runner.ts`, but the older patch runtime path writes directly. The guarantee should be stated carefully until all write paths are confirmed or unified.

7. The React Mission Control docs and source are active and substantial, but Build Week rules explicitly prevent them from automatically overriding the submission mission. Any next action should first resolve mission selection and demo relevance rather than continuing the old dashboard continuation chain by default.
