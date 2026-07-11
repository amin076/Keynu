# ADR-0009 BrowserAgent Decomposition

## Status
Accepted

## Problem

BrowserAgent has gradually become responsible for too many concerns:

- Watching ChatGPT
- Parsing KAP
- Duplicate detection
- Persistent job tracking
- Scheduler interaction
- Runtime event publishing
- Report delivery
- Session updates
- Error handling

This violates the Single Responsibility Principle.

---

## Decision

BrowserAgent will be decomposed into independent Runtime Services.

BrowserAgent becomes only the Browser adapter.

------------------------------------------------

BrowserWatcher

Responsibilities:
- Observe ChatGPT
- Detect new assistant messages
- Publish browser.message.detected

------------------------------------------------

KapParserService

Responsibilities:
- Parse KAP envelopes
- Validate protocol
- Publish runtime.kap.parsed

------------------------------------------------

JobManager

Responsibilities:
- Duplicate detection
- PersistentJobStore
- Job lifecycle

------------------------------------------------

Scheduler

Responsibilities:
- Queue
- Priority
- Dispatch

------------------------------------------------

Orchestrator

Responsibilities:
- Driver selection
- AI selection
- Workflow routing

------------------------------------------------

ReportService

Responsibilities:
- Build reports
- Compact reports
- Deliver reports

------------------------------------------------

SessionService

Responsibilities:
- Runtime state
- Memory restoration
- Session persistence

------------------------------------------------

## Communication

All services communicate exclusively through the Event Bus.

No Runtime Service may call another Runtime Service directly.

------------------------------------------------

## Goal

BrowserAgent becomes a thin adapter (<200 lines), while Runtime logic lives in modular services coordinated by the Event Bus.