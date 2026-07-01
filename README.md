# Keynu

Keynu is an AI Runtime that executes provider-neutral jobs and routes them to drivers such as Dehlero.

## Current status

This refactor keeps the existing JSON task format working and adds the first KAP/capability foundation.

## Commands

```powershell
npm install
npm run build
npm run dev
```

## Queue input

Put `.json` files in `inbox/`.

Supported formats:

- Legacy task JSON using `driver` + `action`
- KAP v1 job envelope using `capability`

## Example KAP job

```json
{
  "kap": "1.0",
  "type": "JOB",
  "id": "kap-write-test-001",
  "priority": "normal",
  "workflow": {
    "steps": [
      {
        "capability": "filesystem.writeFile",
        "payload": {
          "path": "runtime-data/hello.txt",
          "content": "Hello from KAP"
        }
      }
    ]
  }
}
```
