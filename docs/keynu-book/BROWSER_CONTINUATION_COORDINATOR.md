# Keynu Browser Continuation Coordinator

Status: Implemented foundation
Version: 0.1

## Purpose

The Browser Continuation Coordinator connects completed KAP reports to the mission-continuation system without embedding persistence and deduplication logic directly inside BrowserAgent.

## Responsibilities

After BrowserAgent delivers a report, the coordinator:

1. evaluates whether the report completed or failed;
2. creates a `WAITING_AI` continuation contract;
3. declares the next safe action or recovery action;
4. persists continuation state before messaging the AI;
5. delegates delivery to the deduplicated continuation service;
6. returns the delivery result to BrowserAgent.

## Successful Report

A successful report requests the next safe and verifiable KAP job.

## Failed Report

A failed report requests an AI recovery decision and increments the consecutive-failure counter.

## Separation of Concerns

BrowserAgent remains responsible for browser communication and report delivery.

The coordinator owns continuation orchestration.

ContinuationStore owns mission continuation persistence.

ContinuationDeliveryService owns request delivery, retry, and duplicate suppression.

## Next Integration

BrowserAgent must call `continueAfterReport` immediately after sending a verified report and recording the job in MissionManager.
