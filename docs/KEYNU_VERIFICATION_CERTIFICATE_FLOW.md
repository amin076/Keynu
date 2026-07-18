# Keynu Verification Certificate Flow

Version: 1.0
Status: Design

## Goal

Attach verification results and certificates to KAP REPORT messages.

## Flow

KAP JOB
 |
 v
Runtime Execution
 |
 v
VerificationEngine
 |
 v
CertificateBuilder
 |
 v
Verification Certificate
 |
 v
KAP REPORT

## Rules

- Failed execution cannot become verified.
- Verification requires evidence.
- Certificates must contain verification checks.
- Reports should expose trust state.

## Future Status Levels

EXECUTED
VERIFIED
TESTED
CERTIFIED

## Next Implementation

BrowserAgent should return KAP REPORT with verification metadata after successful jobs.
