# KAP Architecture Requirements

## Status

Design foundation for Priority 1.5. This document identifies the protocol capabilities that must be specified and implemented after the initial KAP 1.0 bootstrap foundation.

## Required Envelope Improvements

- correlationId: connects REPORT, ERROR, ACK, and CONTROL messages to their originating message.
- replyTo: identifies the exact message being answered.
- traceId: groups all messages belonging to one execution trace.
- missionId: associates work with a mission.
- workflowId: associates work with a multi-job workflow.
- sequence: preserves message ordering.
- contentType: declares the payload representation.
- schema: identifies the payload schema and revision.

## Reliability

- idempotencyKey for duplicate execution prevention.
- timeout and deadline semantics.
- retry policy with attempt count and retry eligibility.
- acknowledgement states for received, accepted, rejected, and completed messages.
- resumable execution after connection loss.
- terminal-state rules.

## Capability and Version Negotiation

- supported protocol versions.
- supported message types.
- supported targets and drivers.
- report-size and transport limits.
- optional extensions.
- compatibility and downgrade rules.

## Errors

Every protocol failure should expose:

- errorCode
- category
- message
- retryable
- details
- failedMessageId
- failedStep

## Large Payloads

KAP must support summary-first reports and optional chunked payload delivery using:

- chunkId
- chunkIndex
- chunkCount
- finalChunk
- checksum
- artifact references

## Security

Transport-specific security may be supplied by HTTP, WebSocket, MCP, or another connector. KAP must still define optional fields for:

- sender identity
- authentication context
- authorization scope
- message signature
- integrity checksum

## Schema and Validation

Canonical JSON Schemas must be created for:

- base envelope
- MISSION_BOOTSTRAP
- MISSION_ACK
- JOB
- REPORT
- ERROR
- CONTROL
- capability negotiation

Runtime validation must reject malformed, unsupported, or unsafe messages before execution.

## Design Rule

KAP remains an application-level protocol. It may be transported over browser chat, files, HTTP, WebSocket, JSON-RPC, MCP, or future connectors without changing its core message meaning.
