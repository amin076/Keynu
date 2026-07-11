# Event Bus Phase 2

## Current Status

✔ Generic EventBus
✔ BrowserEventBus
✔ BrowserEvents
✔ ConversationWatcher publishes MESSAGE_DETECTED
✔ BrowserAgent subscribes
✔ BrowserEventLogger
✔ Bootstrapped during BrowserDriver initialization

---

## Phase 2 Goals

### 1. Remove direct dependencies

BrowserAgent should no longer call ConversationWatcher methods except startup.
Everything should arrive through BrowserEventBus.

### 2. Event-driven Runtime

MESSAGE_DETECTED
    ↓
KAP_EXTRACTED
    ↓
JOB_ACCEPTED
    ↓
JOB_STARTED
    ↓
JOB_COMPLETED
    ↓
REPORT_SENT

Every step becomes an Event.

### 3. Runtime Dashboard

Dashboard subscribes to BrowserEventBus.
No polling.

### 4. Multi-Agent

ChatGPT
Codex
Claude
Gemini

All publish into the same EventBus.

### 5. Driver Events

filesystem.finished
powershell.finished
blender.finished
youtube.finished
esbiko.finished

No component communicates directly anymore.

### Final Goal

Keynu becomes a true Event-driven Runtime OS instead of a Browser automation tool.