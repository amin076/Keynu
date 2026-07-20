# Keynu OpenAI Build Week Progress

## Project Goal

Keynu is evolving from a BrowserAgent-only connection into a provider-neutral AI runtime capable of connecting missions, AI providers, KAP, and local tools. BrowserAgent remains the working ChatGPT browser path while the runtime gains provider interfaces and API-provider foundations for future AI systems.

## Completed Work

### Phase A - Provider Architecture

- Added the `AIProvider` abstraction.
- Added `ProviderCapabilities` for declaring provider features without provider-specific branching.
- Added `ProviderRegistry` for in-process provider registration and lookup.
- Added `ProviderSession`, `ProviderTask`, and `ProviderResult`.
- Added `BrowserAgentProvider` as the first provider implementation.
- Preserved existing BrowserAgent behavior; the provider adapter does not replace the current BrowserAgent startup path.

### Phase B - Generic API Runtime

- Added `APIProvider` as a reusable runtime for API-backed providers.
- Added `APIConversation` and provider-neutral messages.
- Added transport-independent `ProviderRequest` and `ProviderResponse` models.
- Added `TransportAdapter` so providers can use REST, SSE, WebSocket, local HTTP, or future transports behind a common boundary.
- Added reusable streaming events: `started`, `delta`, `usage`, `completed`, `failed`, and `cancelled`.
- Added retry, timeout, cancellation, normalized errors, generic usage accounting, and request/response logging hooks.

### Phase C - OpenAI Provider

- Added a removable OpenAI provider plugin under `src/providers/openai/`.
- Mapped generic provider requests to the OpenAI Responses API inside the plugin boundary.
- Added an OpenAI prompt builder, response interpreter, authentication module, REST transport, and streaming mapper.
- Kept KAP parsing and REPORT generation out of the provider.
- Added mocked tests for configuration, authentication, prompt mapping, response interpretation, streaming, transport, provider lifecycle, and provider registration.

### Phase D - Runtime Activation

- Added secure environment-only OpenAI configuration.
- Added conditional provider composition that always registers BrowserAgent and registers OpenAI only when valid OpenAI configuration is available.
- Preserved BrowserAgent fallback and avoided automatic provider routing.
- Added secret redaction for OpenAI diagnostics and smoke-test failures.
- Added an explicit smoke-test entry point:

```powershell
node dist/providers/openai/runOpenAISmokeTest.js
```

- Added an optional live smoke test gated by `KEYNU_RUN_OPENAI_LIVE_TEST=true` and `OPENAI_API_KEY`.
- No real OpenAI API call has been performed yet.
- Automatic provider routing is not implemented yet.

### Phase E - Provider Response Runtime

- Implemented and ready for the BW-005-COMMIT checkpoint.
- Added `ProviderRuntime` as the reusable provider response pipeline.
- Moved canonical generic KAP extraction to `KapInterpreter`.
- Added `KapValidator`, `RuntimeDispatcher`, `RuntimeResult`, `RuntimeEvent`, execution context, and execution status models.
- Refactored BrowserAgent to process assistant messages through `ProviderRuntime.execute()`.
- Kept OpenAIProvider unchanged; OpenAI still returns `ProviderResponse`.
- Preserved `KapExtractor` as a compatibility adapter over the new interpreter and validator.
- Added focused runtime tests for normal KAP blocks, `id="..."` metadata, whitespace, multiple blocks, malformed JSON, invalid KAP envelopes, no-KAP responses, JOB, REPORT, ERROR, BrowserAgent compatibility, OpenAI compatibility, deterministic event ordering, and validation-before-dispatch.

## Current Architecture

```text
Mission
  |
Provider Task / Request
  |
Provider Composition and Registry
  |
  +-- BrowserAgentProvider --> ChatGPT browser
  |
  +-- OpenAIProvider --> OpenAI API
  |
Provider Response
  |
Provider Runtime
```

The next missing runtime boundary is:

```text
ProviderResponse
  -> ProviderRuntime
  -> KapInterpreter
  -> KapValidator
  -> RuntimeDispatcher
  -> execution result
  -> continued AI interaction
```

### Phase F Recovery Review - REJECTED_AS_DUPLICATE

Phase F initially created an untracked `src/continuation/` subsystem. A recovery
review found that Keynu already has an operational continuation cycle through
BrowserAgent and the existing mission continuation foundation:

```text
ChatGPT assistant JOB
  -> ProviderRuntime
  -> BrowserAgent
  -> routeKapJob() / Runtime.execute()
  -> verified KAP REPORT
  -> ConversationManager.sendMessage()
  -> BrowserContinuationCoordinator
  -> ContinuationStore / ContinuationDeliveryService
  -> KEYNU_CONTINUATION_REQUEST
  -> ConversationWatcher waits for the next assistant response
```

The untracked Phase F subsystem was not connected to production and introduced
parallel state, report, policy, history, and result models. It was removed. The
existing BrowserAgent plus `BrowserContinuationCoordinator` path remains the
authoritative continuation architecture.

## Verification Status

- TypeScript compilation passed using the local Node runtime.
- Provider tests passed.
- BrowserAgent regression tests passed.
- Mission tests passed after stale active-mission expectations were updated for OpenAI Build Week.
- The optional OpenAI live smoke test was skipped.
- No real OpenAI API request was made.
- The Playwright contenteditable composer test is environment-blocked when the local Playwright Chromium executable is missing.

`npm run build` was attempted, but `npm` was not available on the PowerShell `PATH`. Equivalent local Node build commands passed:

```powershell
node node_modules/typescript/bin/tsc
node node_modules/esbuild/bin/esbuild src/app/graph3d/graph3dClient.ts --bundle --format=esm --platform=browser --target=es2022 --outfile=dist/app/public/graph3dClient.js
node node_modules/vite/bin/vite.js build --config apps/mission-control/vite.config.ts
```

## Next Planned Phase

Corrected Phase F follow-up: adapt future API-provider execution to the
existing BrowserAgent/mission continuation flow through a minimal source-backed
adapter. Do not add a second continuation state machine.
