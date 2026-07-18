# AI Provider Architecture

Date: 2026-07-18

## Purpose

Keynu needs to work with multiple AI systems without making BrowserAgent the only runtime shape.

The provider architecture introduces a small abstraction for AI endpoints while preserving the current BrowserAgent behavior. BrowserAgent remains the first provider implementation and still owns the existing ChatGPT browser workflow.

This is an architectural extension, not a rewrite.

## Goals

- Keep Mission Priority as the foundation for all providers.
- Represent BrowserAgent as the first AI provider.
- Allow future providers such as Codex, Claude, Gemini, and local LLMs.
- Avoid changing KAP, BrowserAgent startup behavior, Dashboard, or Mission Priority behavior in this phase.
- Keep provider contracts small enough to implement incrementally.

## Source Layout

```text
src/providers/
  AIProvider.ts
  ProviderCapabilities.ts
  ProviderRegistry.ts
  ProviderResult.ts
  ProviderSession.ts
  ProviderTask.ts
  index.ts
  browser/
    BrowserAgentProvider.ts
  tests/
    BrowserAgentProvider.test.ts
    ProviderRegistry.test.ts
```

## Core Interfaces

### AIProvider

`AIProvider` is the provider contract. A provider has:

- stable `id`
- display `name`
- declared `capabilities`
- `createSession()`
- `start()`
- optional `stop()`
- optional `execute()`

The interface supports both long-running interactive providers and future task-style providers.

### ProviderCapabilities

Capabilities describe what the provider can do without forcing runtime logic to inspect provider-specific classes.

Current capability names include:

- `mission.bootstrap`
- `kap.receive`
- `kap.send`
- `conversation.watch`
- `continuation.request`
- `job.execute`
- `text.generate`

BrowserAgent currently advertises:

- browser transport
- Mission Bootstrap support
- KAP send/receive support
- conversation watching
- continuation request support

### ProviderSession

`ProviderSession` stores provider-local session identity and optional mission assignment:

- `id`
- `providerId`
- `status`
- `missionProjectId`
- `missionId`
- `conversationUrl`
- timestamps
- provider metadata

Session mission fields do not select the active mission. They record assignment to the mission identity resolved by `ActiveMissionResolver`.

### ProviderTask

`ProviderTask` is the generic unit of provider work. It can represent:

- starting a session
- sending a message
- executing KAP
- generating text
- custom future work

Tasks may carry `missionProjectId` and `missionId`, but those values must come from Mission Priority resolution or explicit mission-aware policy.

### ProviderResult

`ProviderResult` is the normalized provider operation result:

- `providerId`
- `taskId`
- status
- optional `session`
- optional output/error
- metadata

### ProviderRegistry

`ProviderRegistry` stores available providers in-process.

It supports:

- register
- get
- has
- list
- find by capability

The registry does not select active missions and does not execute provider work by itself.

## BrowserAgent Provider

`BrowserAgentProvider` is the first provider implementation.

Provider id:

```text
browser-agent-chatgpt
```

It wraps `BrowserAgentApp`:

```text
ProviderSession(conversationUrl)
  -> BrowserAgentProvider.start()
  -> BrowserAgentApp.start()
```

This preserves existing behavior. The current `runBrowserAgent.ts` entrypoint still constructs `BrowserAgentApp` directly. The provider adapter exists for future orchestration and selection, not to change runtime behavior in this phase.

## Lifecycle

Current lifecycle:

```text
ProviderRegistry registers BrowserAgentProvider
  -> caller creates ProviderSession with conversationUrl
  -> caller starts provider
  -> BrowserAgentProvider delegates to BrowserAgentApp
  -> BrowserAgentApp performs Mission Priority resolution, reconciliation, bootstrap policy, and BrowserAgent startup
```

Future lifecycle:

```text
Mission Priority resolves active mission
  -> orchestration selects provider by capability and configuration
  -> provider session is assigned resolved mission identity
  -> provider starts or executes task
  -> provider result reports normalized outcome
```

## Provider Selection

Provider selection should be explicit and capability-driven.

Examples:

- Need live ChatGPT conversation watching: choose provider with `conversation.watch` and browser transport.
- Need local model text generation: choose provider with `text.generate` and local transport.
- Need Codex repository execution: choose provider with future Codex capability.

Selection must not imply mission selection. Active mission identity remains resolved by `ActiveMissionResolver`.

## Mission Assignment

Mission assignment flows from Mission Priority into providers:

```text
ActiveMissionResolver.resolve()
  -> resolved project id / mission id
  -> ProviderSession missionProjectId / missionId
  -> ProviderTask missionProjectId / missionId
  -> provider execution
```

Providers may record the mission they are serving, but they must not decide which mission is active.

This keeps BrowserAgent, future Codex integration, graph intelligence, continuation, and local models aligned on the same mission identity.

## Future Codex Integration

Codex should be added as a new provider, not by special-casing BrowserAgent.

Expected future shape:

```text
CodexProvider implements AIProvider
  id: codex
  transport: cli or api
  capabilities:
    - job.execute
    - text.generate
    - possibly kap.receive / kap.send
```

CodexProvider should:

- receive resolved mission identity from Mission Priority
- accept mission-aware `ProviderTask` values
- return normalized `ProviderResult`
- avoid selecting missions from stale state or session history
- integrate with KAP only after a separate protocol review

This phase does not implement Codex.

## Non-Goals

This phase does not:

- change BrowserAgent runtime behavior
- modify KAP
- modify Dashboard
- implement Codex, Claude, Gemini, or local LLM providers
- introduce provider persistence
- replace Mission Priority
- add provider UI

## Validation

Added tests verify:

- provider registration and lookup
- duplicate provider protection
- capability search
- BrowserAgentProvider capability declaration
- BrowserAgentProvider delegates to a BrowserAgentApp-compatible adapter
- missing `conversationUrl` fails without starting BrowserAgent

Existing BrowserAgent startup integration tests continue to validate that Mission Priority behavior remains unchanged.
