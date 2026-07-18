# Keynu Mission Continuation Engine

Status: Draft
Version: 0.1

## Purpose

The Mission Continuation Engine prevents silent or unexplained stopping during multi-step work.

Every pause, stop, retry, handoff, or continuation must have an explicit machine-readable reason.

## Core Principle

Every stop must be intentional and explainable.

An execution component must never become idle merely because it does not know what to do next.

## Mission Loop

1. Receive or restore a mission.
2. Select the next actionable step.
3. Ask an AI agent when reasoning is required.
4. execute a KAP job.
5. collect the report.
6. evaluate progress.
7. continue locally, ask the AI, ask the user, retry, recover, or complete.
8. persist the continuation state.

## Continuation States

- CONTINUE
- LOCAL_CONTINUE
- WAITING_RUNTIME
- WAITING_AI
- WAITING_USER
- WAITING_EXTERNAL_SYSTEM
- RECOVERING
- BLOCKED
- COMPLETED
- FAILED

## Stop Reasons

A stopped workflow must record one of the following:

- MISSION_COMPLETED
- USER_INPUT_REQUIRED
- RUNTIME_RESULT_REQUIRED
- AI_DECISION_REQUIRED
- EXTERNAL_SYSTEM_REQUIRED
- RETRY_SCHEDULED
- RECOVERY_IN_PROGRESS
- SAFETY_BLOCKED
- VALIDATION_FAILED
- UNRECOVERABLE_FAILURE

## Continuation Contract

Every AI response participating in an autonomous mission should provide a continuation declaration.

Example:

```json
{
  "continuation": {
    "decision": "CONTINUE",
    "reason": "The previous build passed and the next implementation step is known.",
    "nextAction": "generate_job",
    "needs": "runtime",
    "missionComplete": false
  }
}
```

When user input is required:

```json
{
  "continuation": {
    "decision": "WAITING_USER",
    "reason": "Authentication approval is required.",
    "nextAction": "request_user_input",
    "needs": "user",
    "missionComplete": false
  }
}
```

## Autonomous Prompting

After delivering a REPORT, BrowserAgent or MissionEngine should request the next AI decision when all of these conditions are true:

- the mission is active;
- no user-only input is required;
- the report has been delivered;
- no other job is currently running;
- continuation policy permits autonomous progress;
- retry and loop limits have not been exceeded.

The follow-up message should include:

- mission identifier;
- completed job identifier;
- report status;
- current mission state;
- known next steps;
- blocking conditions;
- a request for either the next KAP job or an explicit stop declaration.

## Required AI Response Behaviour

The AI must respond with one of:

1. A new KAP JOB plus a continuation declaration.
2. An explicit WAITING state and reason.
3. A mission completion declaration.
4. A recovery or retry instruction.

Silence or an unexplained non-KAP response during an active autonomous mission is treated as a continuation protocol failure.

## Safety

Autonomous continuation does not bypass:

- command safety;
- user permissions;
- authentication boundaries;
- destructive-operation approval;
- runtime verification;
- retry limits;
- mission budgets.

## Loop Protection

The engine must track:

- consecutive failures;
- repeated identical jobs;
- repeated identical reports;
- maximum autonomous steps;
- elapsed mission time;
- token or cost budgets where available;
- last meaningful progress time.

A loop guard must transition the mission to BLOCKED rather than continuing indefinitely.

## Persistence

Continuation state must survive:

- BrowserAgent restart;
- ChatGPT reconnection;
- Runtime restart;
- operating-system restart;
- interrupted report delivery.

## Relationship to KAP

The continuation contract extends KAP orchestration but does not replace JOB and REPORT envelopes.

JOB performs work.
REPORT proves the result.
CONTINUATION determines what happens next.
