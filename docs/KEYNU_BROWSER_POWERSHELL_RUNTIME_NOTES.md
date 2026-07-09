# Keynu Browser PowerShell Runtime Notes

## Current loop

ChatGPT sends a KAP JOB in the watched conversation.
BrowserAgent extracts the KAP block.
If payload.target is powershell, BrowserAgent routes the job through routeKapJob.
PowerShell applies reads/writes/commands/build.
Keynu sends a KAP REPORT back to ChatGPT.

## Important runtime note

BrowserAgent is a long-running Node process. If TypeScript source files are changed and npm run build succeeds, the currently running BrowserAgent still uses modules already loaded in memory.

To apply changes to BrowserAgent, restart it:

Ctrl+C
npm run build
npm run browser-agent

This is why reportMode=summary changes in dist may not affect the currently running agent until restart.

## Stable checkpoint

The following features are working:

- BrowserAgent reads KAP JOB blocks from ChatGPT.
- target=powershell routes to PowerShell runtime.
- PowerShell can read files, write files, run commands, run npm build, and return git status/diff.
- BrowserAgent has in-memory duplicate job protection.
- PowerShell read reports support reportMode=summary after BrowserAgent restart.
