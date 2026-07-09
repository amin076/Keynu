# Keynu PowerShell Agent v0.5 Refactor

This refactor removes duplicate PowerShell execution logic and makes one shared runner the heart of the driver.

## Core file

```txt
src/drivers/powershell/powershell-runner.ts
```

It provides:

- `runPowerShellCommand`
- `readPowerShellFile`
- `writePowerShellFile`
- `listPowerShellFiles`
- `collectGitSnapshot`

All CLIs and runtime code should use this runner.

## Important NodeNext rule

All local TypeScript imports use `.js` extensions because Keynu uses:

```json
"module": "NodeNext",
"moduleResolution": "NodeNext"
```

## Recommended cleanup after copying v0.5

Keep:

```txt
PowerShellDriver.ts
powershell-runner.ts
powershell-context.ts
powershell-fileops.ts
powershell-runtime.ts
powershell-safety.ts
powershell-types.ts
context-cli.ts
fileops-cli.ts
runtime-cli.ts
index.ts
```

Delete old duplicate files if they exist:

```txt
powershell.context.ts
powershell.fileops.ts
```

## Test

```powershell
cd C:\Physics\Keynu
npm run build
node dist/drivers/powershell/runtime-cli.js run examples/powershell/powershell-runtime-job.example.json
```
