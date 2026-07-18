# Keynu Mission State Machine

Status: Draft
Version: 0.1

## States

NEW
PLANNING
RUNNING
WAITING_REPORT
EVALUATING
LOCAL_CONTINUE
WAITING_AI
WAITING_USER
WAITING_EXTERNAL_SYSTEM
RECOVERING
BLOCKED
COMPLETED
FAILED
CANCELLED

## Normal Flow

NEW -> PLANNING -> RUNNING -> WAITING_REPORT -> EVALUATING

EVALUATING may transition to:

- LOCAL_CONTINUE
- WAITING_AI
- WAITING_USER
- WAITING_EXTERNAL_SYSTEM
- RECOVERING
- BLOCKED
- COMPLETED
- FAILED

## Invariant

An active mission must always have:

- a current state;
- a state reason;
- a last transition time;
- a next-action declaration;
- an owner for the next action.

## Owners

- runtime
- browser_agent
- mission_engine
- ai
- user
- external_system

## Invalid Condition

An active mission with no next-action owner is an orchestration defect.
