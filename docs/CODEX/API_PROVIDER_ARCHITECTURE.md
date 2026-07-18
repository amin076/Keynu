# API Provider Architecture

Date: 2026-07-18

## Purpose

Build Week Phase B introduces the generic API provider runtime for remote and local HTTP-style AI systems.

This phase does not implement OpenAI, Gemini, Claude, DeepSeek, Grok, Codex, or local LLM providers. It creates the shared transport-independent foundation those providers will use later.

Mission Priority and the Phase A provider architecture remain the foundation. API providers receive mission identity from the provider layer and Mission Priority; they do not select active missions.

## Architecture

```text
Mission
  -> KAP
  -> ProviderTask
  -> ProviderRequest
  -> APIProvider
  -> TransportAdapter
  -> External API
  -> TransportAdapter
  -> ProviderResponse
  -> ProviderResult
  -> KAP REPORT
```

The runtime never constructs provider-specific JSON. OpenAI, Gemini, Claude, DeepSeek, Grok, and local model payloads belong inside future provider-specific transport adapters or provider implementations.

## Source Layout

```text
src/providers/api/
  APIProvider.ts
  APIConversation.ts
  APIMessage.ts
  APITransport.ts
  APIStreaming.ts
  APIConfig.ts
  APIError.ts
  APITokenUsage.ts
  ProviderRequest.ts
  ProviderResponse.ts
  index.ts
```

## Runtime Flow

1. A higher-level orchestrator creates a `ProviderTask`.
2. Mission-aware code assigns `missionProjectId` and `missionId`.
3. Generic API code creates a `ProviderRequest`.
4. `APIProvider` applies config, timeout, retry, cancellation, and logging policy.
5. A `TransportAdapter` executes or streams the request.
6. The adapter returns a transport-independent `ProviderResponse` or stream events.
7. `APIProvider.execute()` converts the response into a generic `ProviderResult`.

## Transport Abstraction

`TransportAdapter` is the boundary between generic runtime and provider-specific IO.

The generic runtime does not know whether a provider uses:

- REST
- SSE
- WebSocket
- local HTTP
- future transports

Adapter contract:

```ts
interface TransportAdapter {
  readonly id: string;
  execute(request, context): Promise<ProviderResponse>;
  stream?(request, context): APIStream;
  cancel?(requestId, reason): Promise<void>;
}
```

Transport context includes:

- normalized API config
- retry attempt number
- cancellation signal
- optional logger

## Stream Abstraction

Streaming is represented as provider-neutral events:

- `started`
- `delta`
- `usage`
- `completed`
- `failed`
- `cancelled`

The runtime consumes `APIStreamEvent` values, not provider-native SSE chunks or WebSocket frames.

## ProviderRequest

`ProviderRequest` is the transport-independent request model.

It supports:

- provider id
- conversation id
- mission project id
- mission id
- model
- system prompt
- message list
- temperature
- top-p
- max output tokens
- stream flag
- custom future parameters
- abort signal
- metadata

Provider-specific request formatting is out of scope for this model.

## ProviderResponse

`ProviderResponse` is the transport-independent response model.

It supports:

- response id
- request id
- provider id
- model
- assistant message
- text content
- finish reason
- usage
- metadata
- optional raw evidence
- created timestamp

Provider-specific response parsing belongs in future providers/adapters.

## Conversation Model

`APIConversation` stores reusable conversation history.

Supported roles include:

- `system`
- `developer`
- `user`
- `assistant`
- `tool`
- future string roles

The conversation model does not hardcode provider limitations.

## Configuration

`APIConfig` supports:

- endpoint
- api key
- organization
- project
- model
- timeout
- retry count
- stream enabled
- temperature
- top-p
- custom headers
- metadata

The config model intentionally does not reference OpenAI or Gemini names.

## Token Accounting

`APITokenUsage` supports:

- prompt tokens
- completion tokens
- cached tokens
- reasoning tokens
- total tokens
- arbitrary future token categories

This avoids assuming that every provider reports only OpenAI-style metrics.

## Error Model

`APIProviderError` normalizes provider and transport failures into categories:

- authentication
- quota
- network
- timeout
- invalid request
- provider unavailable
- rate limit
- stream interrupted
- internal provider error
- cancelled
- unknown

The normalized error includes retryability, status code, provider error code, cause, and metadata when available.

## Logging

The runtime accepts an `APILogger`.

It emits:

- request logs
- response logs
- attempt number
- request id
- provider id
- endpoint
- model
- duration
- completion/failure/cancellation status

This is intentionally generic so future providers can forward logs to file, graph, telemetry, or dashboard layers.

## Future OpenAI Integration

A future OpenAI provider should:

- implement a transport adapter or provider-specific mapper
- convert `ProviderRequest` into OpenAI request JSON internally
- parse OpenAI responses into `ProviderResponse`
- convert OpenAI stream chunks into `APIStreamEvent`
- map OpenAI usage into `APITokenUsage`
- map OpenAI errors into `APIProviderError`

The Keynu runtime must not construct OpenAI JSON directly.

## Future Gemini Integration

A future Gemini provider should follow the same pattern:

- receive `ProviderRequest`
- map messages and parameters inside Gemini-specific code
- expose only `ProviderResponse` and `APIStreamEvent` to Keynu
- map Gemini usage and errors into generic models

Gemini-specific roles, payloads, and streaming frames must not leak into the generic runtime.

## Non-Goals

This phase does not:

- implement OpenAI
- implement Gemini
- implement Claude, DeepSeek, Grok, or local LLM providers
- modify KAP
- modify Mission Priority
- modify BrowserAgent
- modify Dashboard
- introduce ProviderCoordinator

## Validation

Focused tests cover:

- conversation history and future roles
- request model
- response model
- stream events
- configuration normalization
- error normalization
- retry and logging through transport abstraction
- cancellation delegation
- token accounting
