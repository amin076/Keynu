# Chapter 09 - AI Connectors

## Purpose

AI Connectors integrate external AI systems into KAOS Runtime through a common interface.

The Runtime remains AI-independent while AI models become interchangeable components.

## Supported AI Models

- ChatGPT
- Codex
- Claude
- Gemini
- Local LLM
- Future AI Systems

## Connector Responsibilities

- Connect to AI
- Send prompts
- Receive responses
- Report health
- Publish runtime events
- Handle reconnection

## Standard Connector Interface

- connect()
- disconnect()
- health()
- capabilities()
- send(request)
- receive()

## Capability Examples

- reasoning
- coding
- debugging
- planning
- documentation
- research
- image_generation
- vision

## AI Events

- agent.connected
- agent.disconnected
- agent.selected
- agent.request.sent
- agent.response.received
- agent.completed
- agent.failed
- agent.health.changed

## Design Rules

1. AI connectors never execute Runtime logic.
2. AI connectors never access Drivers directly.
3. AI connectors communicate only through Runtime Events.
4. AI models are replaceable.
5. Runtime owns orchestration.

## Long-term Goal

Multiple AI models should cooperate under a single Runtime, allowing KAOS to choose the best model for each task while maintaining a unified execution workflow.