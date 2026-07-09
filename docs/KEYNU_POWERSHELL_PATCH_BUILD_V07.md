# Keynu PowerShell Patch Build v0.7

v0.7 adds automatic report-file output to the patch flow.

## Features

- Read files from a target `cwd`
- Write files safely inside `cwd`
- Create backups before overwrite
- Run optional commands
- Run optional `buildCommand`
- Collect git branch, status, and diff stat
- Return a KAP REPORT
- Save the KAP REPORT to `.keynu/powershell/reports/`

## Test

```powershell
cd C:\Physics\Keynu
npm run build
node dist/drivers/powershell/patch-cli.js run examples/powershell/powershell-patch-build-job.example.json
```

Optional output override:

```powershell
node dist/drivers/powershell/patch-cli.js run examples/powershell/powershell-patch-build-job.example.json --output .keynu/powershell/reports/manual-output.json
```

## Notes

This is generic. It can target any local repository by changing `payload.cwd`.
