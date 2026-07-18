# Keynu Verification Report Certificate Integration

Version: 1.0
Status: Implementation Design

## Goal

Integrate verification certificates into KAP REPORT responses.

## Current Flow

KAP JOB
 |
 v
BrowserAgent
 |
 v
Runtime Execution
 |
 v
Execution Result
 |
 v
VerificationEngine
 |
 v
CertificateBuilder
 |
 v
Verified KAP REPORT

## KAP REPORT Extension

Future successful reports should include:

- execution result
- verification status
- verification checks
- certificate metadata

Example:

REPORT
{
  status: COMPLETED,
  verification: {
    status: VERIFIED,
    checks: []
  },
  certificate: {
    id: "keynu-cert-...",
    status: "VERIFIED"
  }
}

## BrowserAgent Responsibility

BrowserAgent should not only send execution results.
It should create trusted reports by attaching verification evidence.

## Next Step

Implement a single report builder pipeline:

ExecutionResult
      |
      v
VerificationRuntimeAdapter
      |
      v
CertificateBuilder
      |
      v
KapReportBuilder
      |
      v
Assistant Message
