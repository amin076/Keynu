# Keynu Process Manager v0.1

Goal: support long-running processes such as npm run dev, Vite, Blender, FFmpeg, and Dehlero runtime.

Implemented first module:

- src/drivers/powershell/process-manager/PowerShellProcessManager.ts

Capabilities:

- start process
- list process records
- stop process
- read process logs

Next step:

Create a KAP adapter so ChatGPT can send jobs like:

- processAction: start
- processAction: stop
- processAction: list
- processAction: logs
