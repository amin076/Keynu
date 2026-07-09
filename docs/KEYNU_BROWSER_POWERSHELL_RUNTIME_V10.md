# Keynu BrowserAgent PowerShell Runtime v1.0

This version connects the existing KAP runtime router to the BrowserAgent flow.

Goal:

```txt
ChatGPT -> BrowserAgent -> routeKapJob(job) -> PowerShell Runtime -> KAP REPORT -> BrowserAgent -> ChatGPT
```

## New files

```txt
src/browser/kap-browser-runtime-bridge.ts
src/browser/kap-browser-runtime-bridge-cli.ts
examples/browser/browser-agent-powershell-message.example.txt
docs/KEYNU_BROWSER_POWERSHELL_RUNTIME_V10.md
```

## What it does

`kap-browser-runtime-bridge.ts` can:

1. Read a ChatGPT message as plain text.
2. Extract fenced `kap` or `json` KAP JOB blocks.
3. Route each job through `routeKapJob(job)`.
4. Format the returned KAP REPORT as a fenced `kap` block.
5. Optionally send that report back through a provided `sendMessage()` callback.

## CLI test

After copying the files:

```powershell
cd C:\Physics\Keynu
npm run build
node dist/browser/kap-browser-runtime-bridge-cli.js run examples/browser/browser-agent-powershell-message.example.txt
```

Expected result:

- It extracts the KAP JOB.
- It routes the job to the PowerShell target.
- It writes the test output file.
- It runs `npm run build`.
- It prints a KAP REPORT.

## BrowserAgent integration

Find the place where BrowserAgent reads the latest assistant message from ChatGPT.

After it gets `assistantMessageText`, call:

```ts
import { handleKapMessageWithRuntime } from "./kap-browser-runtime-bridge.js";

await handleKapMessageWithRuntime(assistantMessageText, {
  sendMessage: async (reportText) => {
    // Use the existing BrowserAgent send/paste function here.
    await sendMessageToChatGPT(reportText);
  },
});
```

Replace `sendMessageToChatGPT` with the real function/method your BrowserAgent already uses to paste/send text into ChatGPT.

## Why this is v1.0

Before this version, the PowerShell driver worked through CLI tests only.

This version creates the bridge needed for the real autonomous loop:

```txt
ChatGPT gives a KAP job
BrowserAgent extracts it
Keynu routes it
PowerShell executes it
Keynu creates a report
BrowserAgent sends the report back to ChatGPT
```

## Important

This file does not assume a specific project like Dehlero, Esbiko, or Keynu itself.
The target repository is controlled by `payload.cwd` inside the KAP JOB.
