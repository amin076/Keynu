# Chapter 08 - Runtime Memory

## Purpose

Runtime Memory allows KAOS to preserve operational knowledge across restarts, AI switches and unfinished workflows.

Unlike AI conversation memory, Runtime Memory belongs to the Runtime itself.

## Memory Layers

### Session Memory

- Current AI
- Current Chat
- Current Runtime State
- Current User

### Job Memory

- Queued Jobs
- Running Jobs
- Completed Jobs
- Failed Jobs
- Retry History

### Workflow Memory

- Active Workflow
- Dependency Graph
- Execution Progress
- Blocked Tasks

### Driver Memory

- Registered Drivers
- Driver Health
- Driver Capabilities
- Driver Statistics

### AI Memory

- Connected AI Models
- Context Windows
- Capability Profiles
- Health Status

### Architecture Memory

- ADRs
- Protocols
- Design Decisions
- Runtime Rules

## Persistence

Runtime Memory must survive:

- Browser restart
- Runtime restart
- AI reconnect
- Chat migration
- System reboot

## Memory Events

- memory.loaded
- memory.saved
- memory.updated
- memory.restored
- memory.snapshot.created
- memory.snapshot.loaded

## Design Rules

1. Runtime owns its memory.
2. AI models read Runtime Memory but do not own it.
3. Memory must be versioned.
4. Snapshots must be recoverable.
5. Operational state must be reconstructable after failure.

## Long-term Goal

KAOS should resume unfinished work automatically by restoring its Runtime Memory, without requiring the user to explain the project again.