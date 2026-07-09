# Keynu PowerShell Patch v0.6

This version adds a generic patch job layer for the Keynu PowerShell Agent.

It lets ChatGPT send a KAP job that can:

- read files from any local repo using `payload.cwd`
- write or replace files
- optionally back up existing files before overwrite
- run commands
- run `npm run build`
- collect Git branch/status/diff report
- return a standard KAP REPORT

## Files

```txt
src/drivers/powershell/powershell-patch.ts
src/drivers/powershell/patch-cli.ts
examples/powershell/powershell-patch-job.example.json
docs/KEYNU_POWERSHELL_PATCH_V06.md
```

## Test

```powershell
cd C:\Physics\Keynu
npm run build
node dist/drivers/powershell/patch-cli.js run examples/powershell/powershell-patch-job.example.json
```

Optional output file:

```powershell
node dist/drivers/powershell/patch-cli.js run examples/powershell/powershell-patch-job.example.json -o .keynu/powershell/reports/job-powershell-patch-generic-001.report.json
```

## Job shape

```json
{
  "protocol": "KAP",
  "version": "1.0",
  "type": "JOB",
  "id": "job-powershell-patch-generic-001",
  "payload": {
    "target": "powershell",
    "cwd": "C:\\Physics\\Keynu",
    "readFiles": ["package.json"],
    "writeFiles": [
      {
        "path": "some/file.txt",
        "content": "new content",
        "backup": true
      }
    ],
    "commands": [
      { "command": "git", "args": ["status", "--short"], "allowFailure": true }
    ],
    "runBuild": true,
    "collectGit": true
  }
}
```

## Notes

The patch layer is generic. It is not tied to Dehlero, Esbiko, or Keynu itself. The target repo is always selected by `payload.cwd`.
