# Keynu Mission Manager Architecture

## Purpose

Mission Manager restores project identity, active mission, architecture rules, completed work, open tasks, runtime context, and next actions whenever a new AI conversation connects to Keynu.

## Core Flow

```text
New Conversation
  -> BrowserAgent
  -> SessionHandoffManager
  -> MissionManager
  -> MissionRegistry
  -> MemoryLoader
  -> ProjectInspector
  -> ContextAssembler
  -> ContextBudgeter
  -> MissionValidator
  -> BootstrapBuilder
  -> BrowserAgent
  -> ChatGPT
  -> Mission Acknowledgement
```

## Main Components

- MissionManager
- MissionRegistry
- MissionStateStore
- MemoryLoader
- ProjectInspector
- ContextAssembler
- ContextBudgeter
- MissionValidator
- BootstrapBuilder
- SessionHandoffManager

## Required KAP Types

- MISSION_BOOTSTRAP
- MISSION_ACK
- MISSION_STATUS
- MISSION_UPDATE

## Mission States

- UNCONFIGURED
- LOADING
- VALIDATING
- READY
- BOOTSTRAP_SENT
- ACKNOWLEDGED
- ACTIVE
- PAUSED
- BLOCKED
- FAILED
- COMPLETED

## Initial Delivery Plan

1. Define mission data types.
2. Add project and mission registry files.
3. Implement memory loading.
4. Inspect repository and runtime state.
5. Assemble and budget context.
6. Validate mission readiness.
7. Build structured bootstrap payload.
8. Integrate bootstrap delivery into BrowserAgent.
9. Detect and store mission acknowledgement.
10. Add Mission panel and API to the dashboard.
