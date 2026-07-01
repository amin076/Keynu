# KAP - Keynu Agent Protocol

KAP is the provider-neutral message envelope between AI systems and Keynu.

Phase 1 keeps backward compatibility with the existing task JSON format.

Supported queue inputs:

## Legacy task

```json
{
  "id": "task-001",
  "createdAt": "2026-07-01T00:00:00.000Z",
  "priority": "normal",
  "steps": [
    {
      "driver": "dehlero",
      "action": "sendCommand",
      "payload": {}
    }
  ]
}
```

## KAP job envelope

```json
{
  "kap": "1.0",
  "type": "JOB",
  "id": "kap-job-001",
  "priority": "normal",
  "workflow": {
    "steps": [
      {
        "capability": "dehlero.sendCommand",
        "payload": {}
      }
    ]
  }
}
```
