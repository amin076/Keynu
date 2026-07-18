# Chapter 16 - Keynu Agent Protocol

## Purpose

KAP is the application-level protocol between Keynu and interchangeable AI systems. It defines mission bootstrap, acknowledgement, executable jobs, reports, errors, evidence, certificates, and runtime control messages.

KAP is AI-independent. ChatGPT, Claude, Gemini, Copilot, Qwen, local language models, and future AI connectors may participate without prior Keynu knowledge because Mission Bootstrap includes the protocol guide and required response example.

## Transport and Protocol Layers

HTTP, WebSocket, browser automation, files, MCP, and JSON-RPC may transport messages. KAP defines the Keynu-specific meaning and lifecycle of those messages.

## Core Flow

1. Keynu sends MISSION_BOOTSTRAP.
2. The AI reads the protocol guide and mission context.
3. The AI returns MISSION_ACK.
4. The AI sends small KAP JOB messages.
5. Keynu executes them and returns REPORT or ERROR.
6. Verified work may include evidence and a certificate.

## Required AI Behaviour

- Use valid fenced KAP JSON.
- Never invent execution results.
- Wait for the corresponding REPORT before claiming completion.
- Keep jobs and reports within transport limits.
- Continue automatically after successful reports unless human intervention is required.

## Canonical Specification

See ../KAP/KAP_PROTOCOL_V1.md.
