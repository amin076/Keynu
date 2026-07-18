# Keynu Verification KAP Integration

Version: 1.0
Status: Design

## Purpose

Define how Verification Layer information is attached to KAP REPORT messages.

## Current REPORT

```json
{
  "type": "REPORT",
  "payload": {
    "jobId": "job-id",
    "status": "COMPLETED",
    "result": {}
  }
}
```

## Verified REPORT

Future format:

```json
{
  "type": "REPORT",
  "payload": {
    "jobId": "job-id",
    "status": "COMPLETED",
    "result": {},
    "verification": {
      "status": "VERIFIED",
      "checks": []
    }
  }
}
```

## Certified REPORT

Production certification:

```json
{
  "verification": {
    "status": "CERTIFIED",
    "certificate": {
      "id": "keynu-cert-id"
    }
  }
}
```

## Rules

1. Verification data must not replace execution result.

2. Failed execution remains failed.

3. Evidence must be preserved.

4. Certificate generation happens only after required checks pass.

## Integration Order

1. Runtime execution produces result.

2. VerificationEngine analyzes result.

3. CertificateBuilder creates certificate if allowed.

4. BrowserAgent sends final KAP REPORT.
