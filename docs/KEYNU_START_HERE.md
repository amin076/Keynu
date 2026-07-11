# Keynu Start Here

## Easiest current method v07

1. Start Keynu runtime:

```powershell
cd C:\Physics\Keynu
npm start
```

2. In another PowerShell, run the ChatGPT connector:

```powershell
cd C:\Physics\Keynu
npm run connect:chatgpt
```

This will:

- start isolated Keynu Chrome safely
- NOT kill normal Chrome
- use profile C:\keynu-chrome
- ask you to paste a new ChatGPT chat URL
- start Browser Agent connected to that chat

## New chat priority

After connection, ChatGPT must read Keynu memory files first:

- .keynu/memory/current_state.md
- .keynu/memory/next_steps.md
- .keynu/memory/decisions.md
- .keynu/memory/architecture.md
- .keynu/memory/startup_prompt.md

Then continue Priority 1: Dashboard Mission Control v07/v08.

Next goal: move this connector into Dashboard UI so Amin only clicks Connect ChatGPT.
