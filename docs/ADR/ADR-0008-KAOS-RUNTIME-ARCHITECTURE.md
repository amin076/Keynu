# ADR-0008 KAOS Runtime Architecture

## Status
Accepted

## Vision

Keynu is no longer a Browser Automation tool.

Keynu becomes the Runtime of KAOS.

Everything communicates through Events.

The Runtime is divided into independent layers.

------------------------------------------------

Layer 1
AI Connectors

ChatGPT
Codex
Claude
Gemini
Local LLM

------------------------------------------------

Layer 2
Runtime Orchestrator

Chooses AI
Chooses Driver
Creates Workflow
Schedules Dependencies
Coordinates Multi-Agent execution

------------------------------------------------

Layer 3
Runtime Scheduler

Priority Queue
Retry
Timeout
Pause
Resume
Cancel
Dependency Graph

------------------------------------------------

Layer 4
Event Bus

Single communication backbone.

No direct communication between major runtime modules.

------------------------------------------------

Layer 5
Drivers

Browser
Filesystem
PowerShell
Blender
Esbiko
YouTube
Future Drivers

------------------------------------------------

Layer 6
Applications

Real software executed by Drivers.

------------------------------------------------

Design Rules

1. Everything important publishes Events.
2. Runtime modules never know each other directly.
3. Drivers never know AI.
4. AI never knows Drivers.
5. Orchestrator is the intelligence.
6. Scheduler controls execution.
7. EventBus connects everything.
8. Browser is only one Driver among many.

This architecture becomes the permanent foundation of KAOS Runtime V2.