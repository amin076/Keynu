# Keynu Verification Report Pipeline Implementation

Version: 1.0
Status: Implementation Plan

## Objective

Create a unified pipeline that converts execution results into trusted KAP reports.

## Pipeline

ExecutionResult
      |
      v
VerificationRuntimeAdapter
      |
      v
VerificationResult
      |
      v
CertificateBuilder
      |
      v
VerificationReportBridge
      |
      v
KAP REPORT

## Responsibilities

### Runtime

Only executes tasks and returns execution evidence.

### VerificationRuntimeAdapter

Runs verification checks and creates certificates when conditions are satisfied.

### VerificationReportBridge

Combines:

- execution result
- verification result
- certificate

into a report payload.

### BrowserAgent

Uses the bridge before sending assistant messages.

## Trust Rule

A report can be COMPLETED but not VERIFIED.

A certificate is created only when verification passes.

## Future Extensions

- TESTED state with automated test evidence
- CERTIFIED state with security checks
- Driver-level certification
- Multi-agent verification
