# Keynu

> Give AI the ability to continue real software projects—not just answer prompts.

Keynu is an open-source runtime that enables AI to work on long-running software projects by restoring project context, executing verified local actions, and continuing missions across multiple conversations.

Instead of treating every chat as a new beginning, Keynu helps AI resume where it previously stopped.

---

# The Problem

Today's AI models are remarkably good at reasoning and writing code.

However, real software projects rarely fit inside a single conversation.

Developers repeatedly face the same problems:

- AI forgets previous architectural decisions.
- Long-running work is interrupted when conversations end.
- Local development tools are disconnected from AI reasoning.
- Completed work is difficult to verify.
- Large projects require repeatedly explaining the same context.

As projects grow, AI spends more time rebuilding context than making progress.

---

# The Solution

Keynu introduces a mission-oriented runtime between AI models and local development tools.

Instead of remembering only a conversation, Keynu restores the active mission directly from the repository.

Every completed task becomes part of the project's continuing mission rather than disappearing with the chat.

Keynu combines five core ideas:

- Persistent Mission Memory
- Repository-backed Context
- Controlled Local Execution
- Evidence-based Verification
- Automatic Mission Continuation

Together these allow AI to work on projects that continue for days, weeks, or months.

---

# Why Keynu?

Keynu is not another large language model.

It does not replace ChatGPT or Codex.

Instead, it provides the execution and continuity layer that allows existing AI models to participate in real software engineering workflows.

While AI focuses on reasoning, Keynu focuses on:

- remembering;
- executing;
- verifying;
- continuing.

---

# Build Week Demo

The Build Week demonstration follows one software engineering mission from beginning to end.

```text
Developer
        │
        ▼
 ChatGPT / Codex
        │
        ▼
 Mission Bootstrap
        │
        ▼
 Repository Context Restored
        │
        ▼
 Structured KAP Job
        │
        ▼
 Local Runtime Execution
        │
        ▼
 Verification
        │
        ▼
 Evidence Generated
        │
        ▼
 Continuation Request
        │
        ▼
 Next Mission Step
```

Rather than showing isolated prompts, the demo shows AI continuing one engineering mission across multiple conversations with verified local execution.

---

# Core Capabilities

- Persistent repository-backed mission memory
- Mission bootstrap and acknowledgement
- Structured KAP protocol
- Provider-neutral runtime
- Driver-based local execution
- BrowserAgent
- Automatic continuation engine
- Verification and evidence generation
- Mission Control dashboard
- Mission graph visualization

---

# Architecture

```text
                 Human
                   │
                   ▼
        ChatGPT / Codex / AI
                   │
                   ▼
          Mission Bootstrap
                   │
                   ▼
          Keynu Runtime Core
      ┌────────────┼────────────┐
      ▼            ▼            ▼
 Mission      KAP Runtime    Memory
 Control                     Engine
      │            │            │
      └────────────┼────────────┘
                   ▼
         Driver Capability Layer
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
 Filesystem    BrowserAgent   Applications
                   │
                   ▼
         Verification Engine
                   │
                   ▼
         Evidence & Reports
```

---

# Why Codex?

Codex is excellent at reasoning about code.

Keynu extends that capability by allowing Codex to:

- restore project context;
- execute verified local tasks;
- continue long-running missions;
- coordinate tools through structured KAP messages;
- produce evidence-backed completion reports.

The two systems complement each other rather than compete.

---

# Run Keynu

## Requirements

- Node.js 20+
- npm
- Google Chrome

Install:

```bash
npm install
npm run build
```

Start BrowserAgent:

```bash
npm run browser-agent
```

Run verification:

```bash
npm run test:verification
```

Mission Control:

```bash
npm run dashboard:status
```

---

# Current Status

Keynu currently includes:

- Mission Runtime
- Repository Memory
- BrowserAgent
- Provider Runtime
- KAP Protocol
- Driver Framework
- Continuation Engine
- Verification Engine
- Mission Control Dashboard

These components are actively used to develop real software projects, including Keynu itself and Esbiko.

---

# Vision

Today's AI can generate code.

Tomorrow's AI should be able to build complete software systems over weeks or months without losing its mission.

Keynu is an open-source step toward that future.

---

# License

License information will be added before public release.