# BrowserAgent Verification Flow

## Purpose

BrowserAgent is the bridge between AI KAP messages and Keynu execution. Every executed JOB should produce verified evidence.

## Current Flow

KAP JOB

↓

BrowserAgent

↓

Runtime / Driver

↓

Execution Result

↓

KAP REPORT

## Target Flow

KAP JOB

↓

BrowserAgent

↓

Runtime / Driver

↓

Execution Result

↓

VerificationRuntimeAdapter

↓

VerificationEngine

↓

CertificateBuilder

↓

Certified KAP REPORT

## Integration Rule

Execution result must never be replaced by verification result.

Verification is additional evidence attached to the execution report.

## Next Implementation

1. Import VerificationReportIntegration into BrowserAgent.
2. After Runtime execution completes, generate verification data.
3. Attach verification and certificate fields to KAP REPORT.
4. Test filesystem, powershell, and future drivers.
