# Driver Capability System V01

## Purpose

The Runtime must never guess what a Driver can do.

Every Driver publishes its capabilities during registration.

The Orchestrator uses these capabilities to select the correct Driver automatically.

---

## Driver Descriptor

id
name
version
status
health
priority
supportedPlatforms
capabilities
limits

---

## Example

Browser

- openConversation
- sendMessage
- readAssistant
- uploadFile
- downloadFile

Filesystem

- readFile
- writeFile
- moveFile
- deleteFile
- search

PowerShell

- execute
- backgroundProcess
- killProcess

Blender

- openScene
- render
- animation
- pythonScript

Esbiko

- openSimulation
- loadScene
- startRecording
- stopRecording

YouTube

- uploadVideo
- updateMetadata
- publish

---

Selection Flow

Job
  ↓
Orchestrator
  ↓
Capability Resolver
  ↓
Driver Selected
  ↓
Scheduler
  ↓
Execution

---

Future

Capabilities become queryable by AI:

What drivers can render?
What drivers support recording?
What drivers can upload media?

This removes hard-coded routing and makes the Runtime extensible.