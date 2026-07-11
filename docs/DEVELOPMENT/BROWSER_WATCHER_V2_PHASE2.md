# Browser Watcher V2 - Phase 2

## Goal
Replace polling with an event-driven watcher.

## Current
ConversationWatcher
  -> sleep(500)
  -> readLatestAssistantMessage()

## New
MutationObserver
      ↓
Assistant DOM changed
      ↓
Message ID
      ↓
Streaming detector
      ↓
Stable detector
      ↓
Emit AssistantMessageSnapshot
      ↓
BrowserAgent

## New Components
- DomMutationObserver
- MessageStreamTracker
- StableMessageDetector
- AssistantMessageEmitter

## BrowserAgent
await watcher.waitForNextMessage();

No polling.
No baseline.
No busy loop.

Only browser events.

Target:
Production-grade Browser Watcher.