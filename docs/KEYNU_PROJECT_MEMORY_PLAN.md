# Keynu Project Memory Plan

Problem: long ChatGPT conversations become slow, and new chats lose detailed working context.

Solution: move project memory into the repository.

## Memory folder

.keynu/memory/

Files:

- current_state.md
- next_steps.md
- decisions.md
- architecture.md
- snapshots/

## Startup flow for new chat

1. Start BrowserAgent.
2. Send a KAP job to read .keynu/memory/current_state.md, next_steps.md, decisions.md, architecture.md.
3. ChatGPT summarizes state and continues from next_steps.md.

## Rule

ChatGPT memory is useful, but the source of truth must be Keynu project memory.
