# Keynu PowerShell Runtime Adapter v0.8

This version connects the generic PowerShell patch/build executor to a Keynu runtime-style handler.

Goal:

```txt
ChatGPT -> BrowserAgent -> Keynu Runtime -> PowerShell Runtime Adapter -> PowerShell Patch/Build -> KAP Report -> BrowserAgent -> ChatGPT
```

## New files

```txt
src/drivers/powershell/powershell-runtime-adapter.ts
src/drivers/powershell/runtime-adapter-cli.ts
src/drivers/powershell/index.ts
examples/powershell/powershell-runtime-adapter-job.example.json
```

## Runtime API

Use this from the existing Keynu BrowserAgent/runtime dispatcher when a KAP job has:

```json
{
  "payload": {
    "target": "powershell"
  }
}
```

Call:

```ts
import { handlePowerShellKapJob } from "./drivers/powershell/index.js";

const report = await handlePowerShellKapJob(job);
```

The returned value is a standard KAP REPORT envelope.

## Test

```powershell
cd C:\Physics\Keynu
npm run build
node dist/drivers/powershell/runtime-adapter-cli.js run examples/powershell/powershell-runtime-adapter-job.example.json
```

## What v0.8 adds

- A single runtime entrypoint for PowerShell KAP jobs.
- Automatic report file saving to `.keynu/powershell/reports/`.
- A clean function BrowserAgent/Runtime can call directly.
- Keeps the existing CLI tools working.

## Next step

v0.9 should wire this function into the actual Keynu job dispatcher/BrowserAgent flow, so ChatGPT can send a KAP job and receive the PowerShell report automatically without manually running the CLI.
