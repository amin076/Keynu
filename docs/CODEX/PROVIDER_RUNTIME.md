# Provider Runtime

Date: 2026-07-18

## Pipeline

```text
Provider
  -> ProviderResponse
  -> ProviderRuntime
  -> ResponseInterpreter
  -> KapInterpreter
  -> KapValidator
  -> RuntimeDispatcher
  -> RuntimeResult
```

## Responsibilities

`ProviderRuntime` owns the reusable response-processing pipeline for every provider.

`ResponseInterpreter` converts a provider-neutral `ProviderResponse` into text.

`KapInterpreter` extracts KAP blocks from response text. It supports fenced `kap` blocks, `kap` fences with metadata such as `id="..."`, multiple KAP blocks, whitespace around JSON, and bare balanced JSON for backward compatibility.

`KapValidator` validates KAP protocol, version, type, payload, and schema-specific requirements. It returns structured validation errors.

`RuntimeDispatcher` dispatches validated runtime objects. The default dispatcher accepts `JOB`, `REPORT`, and `ERROR`, and preserves other valid KAP envelopes as unhandled items so callers can handle mission-specific messages such as `MISSION_ACK`.

`RuntimeResult` records status, dispatched items, events, errors, and the original provider response.

## Canonical KAP Parsing Ownership

`KapInterpreter` is the canonical generic KAP extraction implementation.

The older `src/kap/KapExtractor.ts` path remains only as a compatibility adapter. It delegates to `KapInterpreter` and `KapValidator`; it does not maintain a second parser.

## Runtime Behavior

`JOB`, `REPORT`, and `ERROR` envelopes are validated before dispatch. The default dispatcher records those message types as accepted runtime objects. It does not execute shell commands, filesystem actions, or other unsafe behavior.

Valid non-runtime envelopes such as `MISSION_ACK` are preserved as unhandled dispatch items so BrowserAgent can apply its existing mission acknowledgement behavior.

When no KAP block is found, `ProviderRuntime` returns `status=SKIPPED`, no dispatch items, and a deterministic `runtime.completed` event. This is a non-executed result, not a runtime failure.

When multiple KAP blocks are present, blocks are processed in source order. Runtime events are emitted in deterministic order:

```text
response.interpreted
kap.detected
kap.validated | kap.invalid
dispatch.completed | dispatch.skipped
runtime.completed | runtime.failed
```

Malformed JSON or valid JSON that is not a valid KAP envelope cannot reach `RuntimeDispatcher`.

## BrowserAgent Integration

BrowserAgent no longer calls generic KAP extraction directly. It wraps each assistant message as a `ProviderResponse`, calls `ProviderRuntime.execute()`, and then handles the returned KAP envelope according to existing BrowserAgent behavior.

Existing BrowserAgent job execution, mission acknowledgement, report delivery, continuation, and failure handling remain in BrowserAgent. Generic extraction and validation now live in the provider runtime.

## OpenAI Integration

OpenAIProvider remains unchanged. It returns a generic `ProviderResponse`.

The runtime boundary is:

```text
OpenAIProvider
  -> ProviderResponse
  -> ProviderRuntime
  -> RuntimeResult
```

OpenAI-specific response parsing stays inside `src/providers/openai/`. KAP extraction and validation are provider-neutral.

## Future Gemini Integration

Gemini should return the same provider-neutral `ProviderResponse` model. Once Gemini maps provider-specific output into `ProviderResponse`, `ProviderRuntime` can process Gemini responses without Gemini-specific KAP parsing.

Future provider routing should call this runtime pipeline before KAP execution or reporting logic.

## Environment Requirements

The Playwright-backed `ConversationManagerContentEditableComposer` test requires a local Playwright Chromium executable. If it is missing, the test fails at `chromium.launch()` before Keynu application code runs.

The optional installation command is:

```powershell
npx playwright install
```

Do not run that command as part of normal provider-runtime tests unless browser installation is explicitly approved.
