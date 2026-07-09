# Keynu Browser PowerShell v1.1-v1.3

This bundle finishes the remaining bridge steps for the local Codex-like loop.

## v1.1 Duplicate Guard

`kap-browser-runtime-bridge.ts` keeps an in-memory `processedJobIds` set. If BrowserAgent sees the same assistant message twice, the same KAP job is not executed twice.

## v1.2 BrowserAgent Runtime Hook

`browser-agent-runtime-hook.ts` exports:

```ts
createKapRuntimeReplyForAssistantMessage(messageText)
```

The existing BrowserAgent should call this after reading a ChatGPT assistant message. If the function returns a string, BrowserAgent should paste/send it back to ChatGPT.

## v1.3 Safety Gate

`powershell-safety.ts` blocks dangerous commands by default. Examples: delete/remove/format/shutdown/registry/force push patterns.

A job may set:

```json
"allowDangerousCommands": true
```

but normal AI-generated jobs should not use this unless the user explicitly approves.

## Flow

```txt
ChatGPT message
  -> BrowserAgent reads assistant text
  -> createKapRuntimeReplyForAssistantMessage(text)
  -> extract KAP JOB
  -> routeKapJob(job)
  -> target powershell
  -> PowerShell patch/build/git
  -> KAP REPORT
  -> BrowserAgent sends report back to ChatGPT
```

## Test

```powershell
cd C:\Physics\Keynu
npm run build
node dist/browser/kap-browser-runtime-bridge-cli.js run examples/browser/browser-agent-powershell-v11-v13-message.example.txt
```
