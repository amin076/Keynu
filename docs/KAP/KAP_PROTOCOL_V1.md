# Keynu Agent Protocol — KAP 1.0

## Purpose

KAP is the application-level protocol used between Keynu and AI systems such as ChatGPT, Claude, Gemini, Copilot, Qwen, and local language models.

KAP allows an AI and the Keynu runtime to exchange structured missions, executable jobs, reports, errors, acknowledgements, evidence, and control messages.

KAP does not replace HTTP, WebSocket, JSON-RPC, MCP, or operating-system communication. Those technologies may transport KAP messages. KAP defines the meaning and lifecycle of messages exchanged with Keynu.

## Envelope

Every KAP message is a JSON object with these required fields:

- protocol: always KAP
- version: protocol version, currently 1.0
- type: message type
- id: unique message identifier
- createdAt: ISO-8601 timestamp
- payload: type-specific data

KAP JSON sent through an AI chat must be placed inside a fenced kap block.

## Core Message Types

- MISSION_BOOTSTRAP: Keynu introduces itself, the project, mission, rules, context, and required response.
- MISSION_ACK: the AI confirms whether it understood and accepts the mission.
- JOB: the AI requests an executable Keynu operation.
- REPORT: Keynu returns execution status, results, evidence, and optional verification certificate.
- ERROR: execution or protocol failure.
- CONTROL: pause, resume, retry, cancel, or request user action.

## AI Response Rules

1. Read the complete MISSION_BOOTSTRAP before acting.
2. Return the requested MISSION_ACK first.
3. Send executable requests only as valid KAP JOB envelopes.
4. Put each KAP envelope inside one fenced kap block.
5. Use unique job identifiers.
6. Keep jobs small enough for the AI chat transport limit.
7. Do not claim completion before receiving a corresponding REPORT.
8. Continue after a successful REPORT unless human input or manual intervention is required.
9. Treat REPORT evidence as the source of truth.
10. Never invent local execution results.

## Minimal JOB

```kap
{
  "protocol": "KAP",
  "version": "1.0",
  "type": "JOB",
  "id": "job-example-001",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "payload": {
    "target": "powershell",
    "cwd": "C:\\Project",
    "readFiles": ["package.json"],
    "reportMode": "summary"
  }
}
```

## Minimal REPORT

A REPORT must reference the original job through payload.jobId and must expose COMPLETED or FAILED status. Verified reports may also include verification and certificate fields.

## Compatibility

An AI does not need prior knowledge of Keynu. The MISSION_BOOTSTRAP must contain or reference this protocol guide and provide enough response instructions for an unfamiliar AI to participate safely.
