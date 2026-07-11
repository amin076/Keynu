# ADR-0007 Event Driven Runtime

## Status
Accepted

## Decision

From this point forward every major Runtime action MUST be published as an Event.

Components MUST communicate through the EventBus instead of direct method calls whenever practical.

## Allowed direct calls

- Bootstrapping
- Construction / Dependency Injection
- Shutdown
- Low-level hardware or Playwright APIs

## Everything else becomes events

browser.message.detected
runtime.kap.received
runtime.kap.parsed
runtime.job.accepted
runtime.job.started
runtime.driver.started
runtime.driver.completed
runtime.job.completed
runtime.job.failed
runtime.report.created
runtime.report.sent

## Future subscribers

- Dashboard
- Logger
- Metrics
- Scheduler
- Memory
- Codex Connector
- Claude Connector
- Gemini Connector
- Esbiko Driver
- Blender Driver
- YouTube Driver

## Long-term Architecture

ChatGPT
    │
    ▼
Browser Runtime
    │
    ▼
Event Bus
 ├── Scheduler
 ├── Dashboard
 ├── Memory
 ├── Logger
 ├── Drivers
 ├── Multi-Agent Manager
 └── Runtime Kernel

The Event Bus becomes the heart of Keynu.
Direct component-to-component communication should gradually disappear.