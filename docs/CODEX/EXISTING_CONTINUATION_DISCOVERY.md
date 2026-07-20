# Existing Continuation Discovery

Date: 2026-07-18
Mission: BW-006-R1
Status: REJECTED_AS_DUPLICATE

## Documents Reviewed

Current or source-backed:

- `.keynu/memory/architecture.md`: current high-level loop is `ChatGPT -> BrowserAgent -> KAP Extractor -> KAP Router -> PowerShell Runtime -> Local Repo -> KAP Report -> ChatGPT`.
- `.keynu/memory/current_state.md`: current checkpoint is runtime graph and BrowserAgent baseline verification, not a new continuation subsystem.
- `.keynu/memory/decisions.md`: repository memory is the project source of truth.
- `.keynu/memory/next_steps.md`: current memory focus is Dashboard/runtime graph recommendations, stale relative to Build Week provider work.
- `.keynu/memory/startup_prompt.md`: confirms new conversations must restore repository memory first.
- `docs/BUILD_WEEK_PROGRESS.md`: current Build Week provider progress through Phase E.
- `docs/CODEX/PROVIDER_RUNTIME.md`: current canonical provider response pipeline and BrowserAgent integration.
- `docs/CODEX/AI_PROVIDER_ARCHITECTURE.md`: BrowserAgent remains the first provider and existing behavior is preserved.
- `docs/CODEX/API_PROVIDER_ARCHITECTURE.md`: API provider runtime ends at `ProviderResponse` and future report conversion is outside provider-specific code.
- `docs/CODEX/OPENAI_PROVIDER.md`: OpenAIProvider remains provider-only and does not parse KAP or build reports.
- `docs/KAP/KAP_PROTOCOL_V1.md`: KAP defines `JOB`, `REPORT`, `ERROR`, continuation behavior, and provider-neutral transport.
- `src/kap/README.md`: stale legacy KAP shape exists beside current KAP 1.0 envelope docs.
- `docs/keynu-book/BROWSER_CONTINUATION_COORDINATOR.md`: implemented foundation matching current source.
- `docs/keynu-book/BROWSER_AGENT_AUTONOMOUS_CONTINUATION.md`: integrated BrowserAgent continuation flow, source-backed.
- `docs/keynu-book/CONTINUATION_DELIVERY.md`: implemented delivery and duplicate suppression, source-backed.
- `docs/keynu-book/CONTINUATION_PERSISTENCE.md`: implemented persistence, source-backed.
- `docs/keynu-book/AI_CONTINUATION_REQUEST.md`: implemented continuation request contract, source-backed.
- `docs/KEYNU_BROWSER_POWERSHELL_RUNTIME_V10.md`: older but source-backed BrowserAgent -> routeKapJob -> report loop.

Stale, draft, duplicated, or contradictory:

- `docs/keynu-book/MISSION_CONTINUATION_ENGINE.md`: draft architecture for a broad continuation engine. It overlaps current implemented continuation coordinator concepts but is not the active production API.
- `docs/BOOK/11_PROJECT_STATUS.md` and `docs/BOOK/12_ARCHITECTURE_AUDIT.md`: July 11 documentation sprint status is stale relative to Build Week provider/runtime work, but still useful for historical direction.
- `docs/CODEX/MISSION_CONTINUATION_RUNTIME.md`: untracked Phase F document described an unused `src/continuation/` subsystem as architecture. It was not production reality and has been removed.

No root `README.md` was present in the repository file list.

## Production Call Flow

Current production continuation behavior is implemented through the existing BrowserAgent and mission continuation foundation:

```text
BrowserAgentApp.start()
  -> SessionStore.read()
  -> ActiveMissionResolver.resolve()
  -> ActiveMissionResolver.buildReconciliationPlan()
  -> ActiveMissionResolver.reconcile() when explicitly required
  -> decideMissionBootstrap()
  -> BrowserDriver.initialize()
  -> BrowserAgent.seedWatcherBaseline()
  -> send MISSION_BOOTSTRAP when required
  -> BrowserAgent.start()

BrowserAgent.start()
  -> BrowserDriver.getConversation()
  -> BrowserDriver.getWatcher()
  -> while true
     -> ConversationWatcher.waitForNewAssistantMessage()
        -> ConversationManager.waitForStableAssistantMessage()
        -> ConversationMemory.hasSeen()/remember()
     -> wrap assistant text as ProviderResponse
     -> ProviderRuntime.execute()
        -> ResponseInterpreter.interpret()
        -> KapInterpreter.interpret()
        -> KapValidator.validateAll()
        -> RuntimeDispatcher.dispatch()
     -> handle first validated KAP envelope
```

For mission acknowledgement:

```text
BrowserAgent.start()
  -> KAP type MISSION_ACK
  -> MissionManager.acknowledge()
  -> SessionStore.patch(createMissionAcknowledgementSessionPatch())
  -> ConversationWatcher.markReported()
```

For `target=powershell` or `target=filesystem` jobs:

```text
BrowserAgent.start()
  -> duplicate job check through processedJobIds
  -> RuntimeGraphTracer.traceQueued()
  -> RuntimeGraphTracer.traceStarted()
  -> routeKapJob()
     -> handlePowerShellKapJob() or executeFileSystemRequest()
     -> target-specific KAP REPORT object
  -> normalize result into RuntimeExecutionResult-like evidence
  -> RuntimeGraphTracer.traceCompleted()
  -> VerificationReportIntegration.createVerifiedReport()
  -> certified report payload
  -> serializeBrowserReport()
     -> createBrowserReport()
     -> compact output for ChatGPT limits
     -> fenced KAP REPORT
  -> ConversationManager.sendMessage()
     -> getMessageInput()
     -> submitMessage()
     -> confirmMessageSubmitted()
  -> MissionManager.recordJob()
  -> MissionManager.getStatus()
  -> BrowserContinuationCoordinator.continueAfterReport()
     -> ActiveMissionResolver.resolve()
     -> reject stale non-active mission
     -> MissionStateStore.getMission()
     -> skip terminal completed mission
     -> ContinuationStore.record()
     -> ContinuationDeliveryService.deliver()
        -> buildContinuationRequest()
        -> ContinuationDeliveryStore.reserve()
        -> ContinuationDeliveryStore.markAttempt()
        -> ConversationManager.sendMessage(KEYNU_CONTINUATION_REQUEST)
        -> ContinuationDeliveryStore.markDelivered()
        -> duplicate delivered request suppression on later attempts
  -> ConversationWatcher.markReported()
  -> loop waits for next assistant response
```

For non-powershell/non-filesystem jobs:

```text
BrowserAgent.start()
  -> kapJobToTask()
  -> Runtime.execute()
  -> VerificationReportIntegration.createVerifiedReport()
  -> inline fenced KAP REPORT on success
  -> ConversationManager.sendMessage()
  -> MissionManager.recordJob()
  -> ConversationWatcher.markReported()
```

For errors and failure:

```text
BrowserAgent.start()
  -> createKapErrorReport()
  -> ConversationManager.sendMessage()
  -> ConversationWatcher.markFailed()
```

For non-KAP assistant responses:

```text
BrowserAgent.start()
  -> ProviderRuntime.execute() returns no valid item
  -> ConversationWatcher.markFailed()
  -> MissionManager.getStatus()
  -> BrowserContinuationCoordinator.continueAfterReport()
     -> sends recovery continuation request when active mission policy allows
```

## Ownership Boundaries

- BrowserAgent owns browser-loop coordination, duplicate in-memory job/ack checks, transport calls, and current execution orchestration.
- ConversationManager owns ChatGPT message input, send action, and submission confirmation.
- ConversationWatcher owns assistant-message detection, baseline tracking, and message processing marks.
- ProviderRuntime owns provider-neutral KAP extraction, validation, and safe dispatch classification.
- routeKapJob and drivers own deterministic local execution for target-specific KAP jobs.
- VerificationReportIntegration owns verification/certificate payload enrichment.
- BrowserReportDelivery owns compact browser-safe report serialization.
- MissionManager owns mission bootstrap, acknowledgement, status, and job recording.
- BrowserContinuationCoordinator owns post-report continuation policy for the active mission.
- ContinuationStore owns persisted continuation state.
- ContinuationDeliveryService and ContinuationDeliveryStore own request construction delivery, retry, reservation, and duplicate suppression.

## Phase F Comparison

| New Phase F component | Existing equivalent | Connected to production | Recommendation |
| --- | --- | --- | --- |
| `ConversationRuntime` | `BrowserAgent.start()`, `ConversationManager.sendMessage()`, `ConversationWatcher.waitForNewAssistantMessage()`, `BrowserContinuationCoordinator.continueAfterReport()` | No | Remove. It creates a second loop and waits for provider responses outside the real watcher/continuation system. |
| `MissionContinuationEngine` | `BrowserContinuationCoordinator`, `ContinuationStore`, `ContinuationDeliveryService`, `MissionStateMachine` | No | Remove. Existing source already coordinates post-report continuation and active-mission gating. |
| `MissionState` | `src/mission/MissionStateMachine.ts` | No | Remove. It defines a conflicting state vocabulary (`READY`, `WAITING_PROVIDER`) beside the existing mission states (`WAITING_AI`, `WAITING_REPORT`, etc.). |
| `MissionContext` | `MissionManagerStatus`, `MissionTypes.MissionContext`, `PersistedContinuationState` | No | Remove. It introduces a parallel mission context shape and history source. |
| `MissionHistory` | `ContinuationStore`, `ContinuationDeliveryStore`, runtime graph tracing, conversation memory | No | Remove. It is in-memory only and duplicates persistence concepts without integration. |
| `ReportBuilder` | `KapReport`, `runtime/kap-job-router`, `BrowserReportDelivery`, `VerificationReportIntegration` | No | Remove. It builds unverified generic reports and bypasses current compaction/certificate behavior. |
| `ProviderReply` | Browser chat message strings, `ContinuationRequest`, `ProviderResponse` | No | Remove. It is a speculative outbound provider model not used by BrowserAgent or OpenAIProvider. |
| `ContinuationPolicy` | `ContinuationTypes`, `buildContinuationRequest`, `BrowserContinuationCoordinator`, autonomous-step limits | No | Remove. It duplicates policy vocabulary and omits active-mission and delivery-store checks. |
| `ContinuationResult` | `BrowserContinuationResult`, `ContinuationDeliveryResult` | No | Remove. It creates a separate result model for an unused loop. |
| `ContinuationEvent` | Browser events, runtime graph events, delivery records | No | Remove. It creates a second event taxonomy. |
| `index.ts` | Existing mission/runtime exports | No | Remove with subsystem. |
| `src/continuation/tests/*` | Existing mission/browser/runtime tests | No | Remove. Tests validated isolated classes rather than production behavior. |

## Core Questions

1. Keynu already completes the `JOB -> execution -> REPORT -> ChatGPT` loop through BrowserAgent, routeKapJob/runtime execution, report creation, ConversationManager submission, and watcher continuation.

2. BrowserAgent-specific parts are ChatGPT browser transport, assistant-message watching, composer submission, submission confirmation, browser-baseline memory, and current in-process duplicate job/ack sets.

3. Generic parts already extracted or partially extracted are KAP interpretation/validation in `ProviderRuntime`, target execution in `routeKapJob` and `Runtime`, report envelope helpers, mission state/continuation contracts, persistence, delivery retry, and active-mission gating.

4. BrowserAgent still makes some orchestration decisions, but mission identity for startup and continuation is not inferred from the browser session. Startup uses `ActiveMissionResolver`; continuation uses `BrowserContinuationCoordinator` with `ActiveMissionResolver`.

5. REPORT creation is not fully centralized. It exists in `KapReport`, target-specific router responses, BrowserAgent inline generic runtime success reports, and Browser report serialization/verification. This is a genuine future refactor target, but the untracked Phase F `ReportBuilder` was not the correct replacement because it bypassed current verification and compact delivery behavior.

6. Conversation continuation is implemented by the watcher loop plus `BrowserContinuationCoordinator`. The watcher waits for next assistant messages; the coordinator sends deduplicated `KEYNU_CONTINUATION_REQUEST` messages after delivered reports.

7. The removed `src/continuation` subsystem would only solve a future provider-neutral outbound-reply abstraction, but it did not integrate with the existing continuation store, delivery records, BrowserAgent watcher, report compaction, verification, or active-mission persistence.

8. That problem is not needed for the Build Week demo now. The Build Week demo needs BrowserAgent to remain stable and OpenAIProvider to remain available without a second unconnected loop.

9. OpenAI API can reuse the existing flow through a small adapter later: OpenAIProvider returns `ProviderResponse`, `ProviderRuntime` extracts KAP, the existing execution/report/continuation services should be reused or extracted from BrowserAgent. A separate `src/continuation` state machine is not required first.

10. Keeping both systems would create duplicate state machines, report builders, retry policies, histories, and continuation results.

## Selected Outcome

Outcome A - Remove Phase F.

Reasoning:

- The untracked subsystem modified no tracked production code and was not called by BrowserAgent, OpenAIProvider, ProviderRuntime, MissionManager, or BrowserContinuationCoordinator.
- Existing source and tests show operational continuation is already implemented through BrowserAgent and mission continuation services.
- The new subsystem introduced conflicting mission states and duplicate report/policy/history models.
- The immediate Build Week goal is better served by preserving the working BrowserAgent continuation path and documenting the actual architecture.

## Final Authoritative Continuation Architecture

The authoritative continuation path remains:

```text
Assistant ProviderResponse
  -> ProviderRuntime
  -> BrowserAgent orchestration
  -> routeKapJob() or Runtime.execute()
  -> target-specific execution result
  -> verification/certificate enrichment
  -> BrowserReportDelivery serialization
  -> ConversationManager.sendMessage()
  -> BrowserContinuationCoordinator
  -> ContinuationStore
  -> ContinuationDeliveryService
  -> KEYNU_CONTINUATION_REQUEST
  -> ConversationWatcher waits for the next assistant message
```

The generic provider-neutral boundary already proven in production is:

```text
ProviderResponse
  -> ProviderRuntime
  -> validated KAP envelope classification
```

The next correct refactor, if needed, is to extract the existing BrowserAgent execution/report/continuation calls into a small reusable adapter while preserving `BrowserContinuationCoordinator`, `ContinuationStore`, `ContinuationDeliveryService`, `BrowserReportDelivery`, and verification behavior.

## Remaining Genuine Gaps

- REPORT construction is still fragmented across `KapReport`, `routeKapJob`, BrowserAgent inline success handling, and Browser report serialization.
- BrowserAgent still owns too much orchestration and should eventually delegate execution/report handling to a source-backed service.
- OpenAIProvider does not yet have a production adapter that sends provider replies or feeds new provider responses into the same execution/report/continuation cycle.
- The existing continuation foundation stores the current continuation state and delivery attempts but does not implement a broad scheduler, queue, planner, or autonomous provider polling system.
- The old `src/browser/kap-browser-runtime-bridge.ts` keeps legacy KAP extraction logic and may be a future cleanup candidate now that `ProviderRuntime` owns canonical parsing.
