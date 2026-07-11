# Chapter 02 - Runtime Architecture

## Runtime Layers

Layer 1
AI Connectors

- ChatGPT
- Codex
- Claude
- Gemini
- Local LLM

Layer 2
Runtime Orchestrator

Responsible for workflow coordination, AI selection and driver selection.

Layer 3
Runtime Scheduler

Responsible for queues, priorities, retries, dependencies and execution order.

Layer 4
Event Bus

The communication backbone of the Runtime.

Layer 5
Runtime Services

- Browser Service
- KAP Service
- Job Service
- Memory Service
- Report Service
- Driver Service
- Dashboard Service

Layer 6
Drivers

- Browser
- Filesystem
- PowerShell
- Blender
- Esbiko
- YouTube
- MCP
- Future Drivers

Layer 7
Applications

External software controlled through Drivers.

## Runtime Rule

Services communicate only through Events.

No Runtime Service should directly depend on another Runtime Service.

## Long-term Goal

The Runtime architecture should remain independent of any specific AI model or application, allowing unlimited extensibility.