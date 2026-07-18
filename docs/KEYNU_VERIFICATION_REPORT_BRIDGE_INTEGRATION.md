# Keynu Verification Report Bridge Integration

Version: 1.0
Status: Implementation Plan

## Goal

Connect VerificationRuntimeAdapter output with KAP report generation.

## Current Components

Runtime
 |
 v
RuntimeExecutionResult
 |
 v
VerificationRuntimeAdapter
 |
 v
VerificationReportBridge
 |
 v
KAP REPORT

## Bridge Responsibility

The bridge should:

1. Receive RuntimeExecutionResult.
2. Execute verification.
3. Generate certificate if verified.
4. Attach verification metadata.
5. Return a trusted report object.

## Suggested Interface

```ts
createVerifiedReport(
  jobId: string,
  executionResult: RuntimeExecutionResult
)
```

Returns:

```ts
{
  execution,
  verification,
  certificate
}
```

## BrowserAgent Integration

Replace:

Runtime Result
 -> createKapSuccessReport()

with:

Runtime Result
 -> VerificationReportBridge
 -> createKapVerifiedReport()
 -> sendMessage()

## Important Rule

Verification must not modify execution status.

Execution failure remains failure.
Verification only adds trust information.

## Next Step

Implement the bridge in source code and add build verification.
