# OpenAI Provider

Date: 2026-07-18

## Purpose

The OpenAI provider is Keynu's first concrete API provider. It uses the generic API provider runtime created in Build Week Phase B and maps Keynu's provider-neutral models to the OpenAI Responses API inside a removable plugin folder.

The provider does not change BrowserAgent, KAP, Mission Priority, Dashboard, MissionManager, or runtime behavior.

## Plugin Boundary

The provider lives under:

```text
src/providers/openai/
```

The folder is self-contained. Keynu's core provider exports do not import it. If `src/providers/openai/` is removed, the rest of Keynu should continue to compile once the OpenAI plugin tests are removed with it.

Phase D adds an optional composition path that loads the OpenAI provider by dynamic import only when OpenAI environment configuration is present. BrowserAgent remains registered independently and is still the default operational path.

## Architecture

```text
ProviderTask
  -> ProviderRequest
  -> OpenAIProvider
  -> APIProvider
  -> OpenAITransport
  -> OpenAI REST endpoint
  -> OpenAIResponseInterpreter
  -> ProviderResponse
  -> ProviderResult
```

OpenAI-specific JSON is built only inside the OpenAI provider folder.

## Files

```text
OpenAIProvider.ts
OpenAITransport.ts
OpenAIConversation.ts
OpenAIStreaming.ts
OpenAIAuthentication.ts
OpenAIConfiguration.ts
OpenAIResponseInterpreter.ts
OpenAIPromptBuilder.ts
index.ts
```

## Configuration

`OpenAIConfiguration` supports:

- `endpoint`
- `apiKey`
- `organization`
- `project`
- `model`
- `timeoutMs`
- `retryCount`
- `temperature`
- `topP`
- `maxTokens`
- `stream`
- custom `headers`
- `metadata`

The default endpoint is configured in `OpenAIConfiguration.ts`; no endpoint is hardcoded in the transport or runtime.

Phase D adds environment loading for:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`
- `OPENAI_ORGANIZATION`
- `OPENAI_PROJECT`
- `OPENAI_TIMEOUT_MS`
- `OPENAI_RETRY_COUNT`

`OPENAI_API_KEY` and `OPENAI_MODEL` are required only when the OpenAI provider is explicitly enabled or invoked. Missing OpenAI configuration does not break BrowserAgent startup, tests, or repository builds.

No real `.env` file is created by Keynu. The repository does not currently use a committed `.env.example`, so Phase D did not add one.

## Secret Handling

OpenAI API keys must be supplied through the environment. They must not be written to `.keynu` memory, session files, reports, Dashboard responses, or logs.

Diagnostics redact configured API keys. Composition and smoke-test failure paths replace the configured key with `<redacted-openai-api-key>` before printing error text.

## Authentication

Authentication is isolated in `OpenAIAuthentication.ts`.

It creates:

- `Authorization: Bearer <apiKey>`
- optional `OpenAI-Organization`
- optional `OpenAI-Project`

The provider and prompt builder do not contain authentication logic.

## Conversation Mapping

`OpenAIPromptBuilder` converts generic `ProviderRequest` values into OpenAI request bodies.

Supported generic roles:

- `system`
- `developer`
- `user`
- `assistant`
- `tool`
- future string roles

The Keynu runtime continues to use `ProviderRequest` and `APIMessage`; it does not construct OpenAI request JSON.

## Transport

`OpenAITransport` implements the generic `TransportAdapter`.

It supports:

- POST requests
- authorization headers
- custom endpoint
- custom headers
- timeout and retry through the generic `APIProvider`
- abort signal pass-through
- non-streaming JSON responses
- streaming SSE responses
- normalized provider errors

All tests use mocked fetch responses. No test calls the real OpenAI API.

## Provider Composition

`src/providers/ProviderComposition.ts` creates the minimal registry composition used by Phase D:

```text
createProviderComposition()
  -> register BrowserAgentProvider
  -> if OpenAI env is valid, dynamically load and register OpenAIProvider
  -> otherwise skip or report invalid OpenAI configuration
```

This is not intelligent routing. It does not change the provider used by BrowserAgent and does not start OpenAI automatically.

## Response Mapping

`OpenAIResponseInterpreter` converts OpenAI response-shaped objects into generic `ProviderResponse`.

It normalizes:

- assistant text
- assistant message
- finish/status reason
- model
- token usage
- metadata
- raw response evidence
- future output/tool metadata

Usage is mapped to generic `APITokenUsage`:

- `input_tokens` -> `promptTokens`
- `output_tokens` -> `completionTokens`
- cached tokens
- reasoning tokens
- total tokens
- future numeric categories

## Stream Mapping

`OpenAIStreaming` maps OpenAI stream events into generic events:

- `started`
- `delta`
- `usage`
- `completed`
- `failed`
- `cancelled`

OpenAI stream objects do not leave the provider folder.

## Explicit Smoke Test

The explicit smoke-test entry point is:

```powershell
node dist/providers/openai/runOpenAISmokeTest.js
```

It loads environment configuration, creates a small `ProviderRequest`, invokes `OpenAIProvider`, and prints only safe result fields:

- status
- model
- finish reason
- token usage
- response text

It returns a non-zero exit code on missing configuration or provider failure.

The smoke test boundary is intentionally:

```text
ProviderRequest
  -> OpenAIProvider
  -> ProviderResponse / ProviderResult
```

KAP REPORT conversion is still future work:

```text
ProviderResponse
  -> Response Interpreter
  -> KAP REPORT
```

## Optional Live Test

The live test is skipped by default. It only runs when both are set:

```text
KEYNU_RUN_OPENAI_LIVE_TEST=true
OPENAI_API_KEY=...
```

The live test may incur OpenAI API charges. Ordinary unit tests and builds use mocked HTTP responses and must not call the real OpenAI API.

## Error Mapping

OpenAI HTTP/status failures are normalized to generic API errors:

- authentication
- quota
- rate limit
- network
- timeout
- invalid request
- provider unavailable
- internal provider error
- cancelled

The generic API runtime handles retry policy based on normalized retryability.

## Limitations

- OpenAI registration is conditional and explicit through provider composition.
- No ProviderCoordinator exists yet.
- There is no automatic provider selection or routing.
- KAP parsing and REPORT generation remain out of scope.
- OpenAI responses are not converted into KAP REPORT messages yet.
- Tool calls are preserved as metadata but not executed.
- Streaming parser supports SSE data frames used by the Responses API; realtime WebSocket support is future work.
- No ordinary tests make real API calls.

## Phase D Implementation Notes

Files added:

- `src/providers/ProviderComposition.ts`
- `src/providers/openai/runOpenAISmokeTest.ts`
- OpenAI environment, composition, smoke-test, and optional live-test test files

Files updated:

- `src/providers/openai/OpenAIConfiguration.ts`
- `src/providers/index.ts`
- `src/providers/openai/index.ts`
- `docs/CODEX/OPENAI_PROVIDER.md`

The current runtime stops at `ProviderResponse / ProviderResult`. KAP REPORT conversion, Dashboard display, and automatic routing are intentionally deferred.

## Future Work

- Add ProviderCoordinator to route mission-aware ProviderTasks.
- Add explicit KAP REPORT conversion for API provider responses.
- Add tool-call handling policy.
- Implement Gemini, Claude, and local HTTP providers using the same generic API runtime.
