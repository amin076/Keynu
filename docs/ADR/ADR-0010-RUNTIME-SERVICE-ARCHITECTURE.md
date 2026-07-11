# ADR-0010 Runtime Service Architecture

## Status
Accepted

## Vision

KAOS Runtime is no longer an application.

KAOS Runtime is a collection of Runtime Services.

Every service owns exactly one responsibility and communicates only through the Event Bus.

------------------------------------------------

## Runtime Services

Browser Service

- Browser Session
- Conversation Watcher
- Browser Events

---------------------------

KAP Service

- Parse
- Validate
- Deserialize

---------------------------

Job Service

- Job Store
- Duplicate Detection
- Lifecycle

---------------------------

Scheduler Service

- Queue
- Priority
- Dependencies

---------------------------

Orchestrator Service

- Workflow
- Driver Selection
- AI Selection

---------------------------

Driver Service

- Driver Registry
- Driver Capabilities
- Driver Health

---------------------------

Report Service

- Report Builder
- Compact Reports
- Report Delivery

---------------------------

Memory Service

- Runtime Memory
- Session Memory
- Workflow Memory
- Snapshot Manager

---------------------------

Metrics Service

- Performance
- Event Statistics
- Runtime Analytics

---------------------------

Dashboard Service

- Live Runtime State
- Event Stream
- Scheduler View
- Driver View

------------------------------------------------

## Runtime Rule

Services MUST NOT know each other.

Services know only the Event Bus.

The Event Bus becomes the permanent communication backbone of KAOS Runtime.

------------------------------------------------

## Target

BrowserAgent becomes only one Runtime Service among many.

No single file should contain the Runtime logic again.
