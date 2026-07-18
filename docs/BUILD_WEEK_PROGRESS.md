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
```

The next missing runtime boundary is:

```text
ProviderResponse
  -> generic KAP interpretation
  -> Runtime dispatch
  -> execution result
  -> continued AI interaction
```

## Verification Status

- TypeScript compilation passed using the local Node runtime.
- Provider tests passed.
- BrowserAgent regression tests passed.
- Mission tests passed.
- The optional OpenAI live smoke test was skipped.
- No real OpenAI API request was made.

`npm run build` was attempted, but `npm` was not available on the PowerShell `PATH`. Equivalent local Node build commands passed:

```powershell
node node_modules/typescript/bin/tsc
node node_modules/esbuild/bin/esbuild src/app/graph3d/graph3dClient.ts --bundle --format=esm --platform=browser --target=es2022 --outfile=dist/app/public/graph3dClient.js
node node_modules/vite/bin/vite.js build --config apps/mission-control/vite.config.ts
```

## Next Planned Phase

Phase E: Provider Response Runtime and KAP execution boundary.

Phase E is not implemented yet.
