# Keynu OpenAI Build Week Submission Concept

## Working Title

Keynu — A Mission Operating System for AI Agents

## One-Sentence Pitch

Keynu enables AI systems to recover long-running missions across conversations, restore repository-backed context, execute local tools through controlled drivers, and verify completed work with concrete runtime evidence.

## Problem

AI assistants are useful for isolated requests, but long-running operational work remains fragile. Context is lost across conversations, reasoning is disconnected from local execution, workflows silently stop, duplicate actions may occur, and completion claims often lack verifiable proof.

## Solution

Keynu places a mission-oriented runtime between AI providers and local applications.

Its existing architecture includes:

- repository-backed mission memory;
- active mission resolution;
- mission bootstrap and acknowledgement;
- structured KAP jobs, reports, errors, evidence, and control messages;
- controlled local execution through drivers;
- provider-neutral runtime foundations;
- continuation recovery after completed or interrupted work;
- verification checks and certificates;
- Mission Control visibility into mission and runtime state.

## Central Build Week Message

> AI agents should not merely answer prompts. They should continue missions safely, remember project state, use real tools, and prove what they accomplished.

## Minimum Competition Demo

1. Connect a new or existing ChatGPT conversation to Keynu.
2. Receive a `MISSION_BOOTSTRAP` for the active Build Week mission.
3. Return a valid `MISSION_ACK`.
4. Send a small and safe `KAP JOB`.
5. Execute the operation through the local Keynu runtime.
6. Return a verified `KAP REPORT`.
7. Display the verification result and certificate evidence.
8. Receive a `KEYNU_CONTINUATION_REQUEST`.
9. Select a new, distinct mission step without repeating completed work.
10. Show the resulting mission and runtime evidence in Mission Control.

## Existing Capabilities Used

- BrowserAgent ChatGPT connection
- ActiveMissionResolver
- MissionRegistry
- MissionManager
- MissionStateMachine
- BootstrapBuilder
- BrowserContinuationCoordinator
- ContinuationStore
- ContinuationDeliveryService
- ProviderRuntime
- KAP extraction, validation, interpretation, and routing
- driver and capability registries
- fail-fast command execution
- verification policies
- verification certificates
- persisted reports
- Mission Control Dashboard

## Demonstration Flow

```text
ChatGPT or another AI requester
              ↓
      Mission bootstrap
              ↓
       Mission acknowledgement
              ↓
          KAP job
              ↓
     Keynu local runtime
              ↓
  Verification and certificate
              ↓
     Continuation request
              ↓
   Distinct next mission step
              ↓
       Mission Control
```

## Codex Role

Codex must contribute materially to Build Week development and that contribution must be visible in repository history and documentation.

Direct runtime integration should reuse Keynu's existing requester-neutral architecture:

```text
Human / ChatGPT / Dashboard / API
               ↓
             Keynu
               ↓
        Mission Request
               ↓
          Codex Driver
               ↓
           Codex CLI
               ↓
      Result Interpretation
               ↓
           KAP REPORT
```

The local Codex execution path must be verified before claiming direct CLI integration.

## Out of Scope Before Submission

- broad dashboard redesign;
- a second mission runtime;
- replacement of the existing continuation architecture;
- unrelated drivers;
- speculative multi-provider expansion;
- large refactors without direct demo value.

## Required Submission Assets

- judge-facing README;
- concise project description;
- architecture diagram;
- verified demo runbook;
- recorded demo video;
- evidence of meaningful Codex usage;
- final build and verification evidence;
- repository and submission checklist.

## Immediate Priorities

1. verify the exact end-to-end demo path;
2. confirm the local Codex execution option;
3. ensure Mission Control presents understandable evidence;
4. rehearse and record the demo;
5. run final build, verification, and repository checks.
