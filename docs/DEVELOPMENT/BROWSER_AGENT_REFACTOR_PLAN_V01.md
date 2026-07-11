# BrowserAgent Refactor Plan

## Goal
Split BrowserAgent into small independent components.

## Current Responsibilities
- Conversation watching
- KAP extraction
- Job execution
- Runtime state
- PersistentJobStore
- Report sending
- Session management
- Error handling

## New Components
1. BrowserAgent (Coordinator)
2. JobExecutionPipeline
3. ReportPipeline
4. RuntimeStateManager
5. JobRecoveryManager
6. ConversationWatcher

## Rule
BrowserAgent must never execute business logic directly.
It only coordinates the pipelines.

## Next Mission
Implement JobExecutionPipeline first.