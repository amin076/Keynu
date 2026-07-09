export function createChatGptOnboardingMessage(): string {
  return `Keynu Browser Agent is connected.

IMPORTANT: Before doing any work, ChatGPT must first restore project context by reading Keynu memory files.

Send this first:

\`\`\`kap
{
  "protocol": "KAP",
  "version": "1.0",
  "type": "JOB",
  "id": "job-keynu-read-project-memory-001",
  "createdAt": "2026-07-09T00:00:00Z",
  "payload": {
    "target": "powershell",
    "cwd": "C:\\\\Physics\\\\Keynu",
    "reportMode": "summary",
    "readFiles": [
      ".keynu/memory/current_state.md",
      ".keynu/memory/next_steps.md",
      ".keynu/memory/decisions.md",
      ".keynu/memory/architecture.md",
      ".keynu/memory/startup_prompt.md"
    ]
  }
}
\`\`\`

After reading memory, continue from next_steps.md.

Available abilities:
- readFiles: read files
- writeFiles: create/edit files and folders
- commands: run safe commands
- buildCommand: run build
- processAction start/list/logs/stop: manage long-running processes

Repository memory is the source of truth.`;
}
