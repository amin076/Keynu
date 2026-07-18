# Keynu BrowserAgent Verification Bridge Flow

Version: 1.0
Status: Integration Design

## Objective

Connect BrowserAgent execution flow with VerificationReportBridge.

## Current Flow

Assistant KAP JOB
        |
        v
BrowserAgent
        |
        v
Runtime.execute()
        |
        v
RuntimeExecutionResult
        |
        v
createKapSuccessReport()

## New Flow

Assistant KAP JOB
        |
        v
BrowserAgent
        |
        v
Runtime.execute()
        |
        v
VerificationReportBridge.create()
        |
        +----------------+
        |                |
        v                v
VerificationResult   Certificate
        |
        v
Verified KAP REPORT

## BrowserAgent Changes

Replace direct success reporting:

Runtime Result
 -> createKapSuccessReport()

with:

Runtime Result
 -> VerificationReportBridge
 -> create verified report
 -> send KAP response

## Requirements

- Never hide runtime failures.
- Add verification only after execution.
- Certificate only when verification passes.
- Keep existing KAP protocol compatibility.

## Future

All drivers should eventually use the same verification pipeline.
