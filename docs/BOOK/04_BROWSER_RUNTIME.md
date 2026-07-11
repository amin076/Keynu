# Chapter 04 - Browser Runtime

## Purpose

The Browser Runtime provides the communication bridge between KAOS Runtime and browser-based AI systems such as ChatGPT.

It is responsible only for browser interaction and must not contain Runtime business logic.

## Main Components

- BrowserSession
- ConversationManager
- ConversationWatcher
- BrowserEventBus
- BrowserEvents

## Responsibilities

BrowserSession
- Connect to Chrome (CDP)
- Manage browser lifecycle

ConversationManager
- Read assistant messages
- Send user messages
- Observe conversation state

ConversationWatcher
- Detect new assistant messages
- Wait until messages become stable
- Publish browser events

BrowserEventBus
- Distribute browser-related events
- Decouple browser components

## Event Flow

Assistant Message
      ↓
ConversationWatcher
      ↓
browser.message.detected
      ↓
KAP Service
      ↓
runtime.kap.parsed

## Design Rules

1. Browser Runtime never executes business logic.
2. Browser Runtime never selects drivers.
3. Browser Runtime never schedules jobs.
4. Browser Runtime only publishes events.
5. Runtime Services consume those events.

## Future

The Browser Runtime should support multiple browser providers while presenting the same event interface to the Runtime.