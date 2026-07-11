# Chapter 03 - Event Bus

## Purpose

The Event Bus is the communication backbone of KAOS Runtime.

Every Runtime Service communicates through Events instead of calling other services directly.

## Benefits

- Loose coupling
- Independent services
- Easier testing
- Easier extension
- Better scalability
- Runtime observability

## Event Flow

Runtime Service
      ↓
Publish Event
      ↓
Event Bus
      ↓
Subscribers
      ↓
Runtime Services

## Event Categories

### Browser Events

- browser.connected
- browser.disconnected
- browser.message.detected
- browser.message.sent

### Runtime Events

- runtime.started
- runtime.stopped
- runtime.kap.received
- runtime.kap.parsed
- runtime.report.created

### Scheduler Events

- scheduler.job.queued
- scheduler.job.dispatched
- scheduler.job.finished
- scheduler.queue.changed

### Driver Events

- driver.registered
- driver.selected
- driver.started
- driver.completed
- driver.failed

### Memory Events

- memory.loaded
- memory.saved
- memory.snapshot.created
- memory.restored

### AI Events

- agent.connected
- agent.selected
- agent.completed
- agent.failed

## Design Rules

1. Publish events instead of calling services.
2. Services subscribe only to events they need.
3. Events should be immutable.
4. Event names should remain stable.
5. Event payloads should be versionable.

## Long-term Goal

Every significant Runtime action should be observable through the Event Bus, making the Runtime fully traceable and extensible.