# ADR-002: Protected Repository Memory

## Status
Accepted

## Summary
The Keynu runtime now protects repository mission memory stored under `.keynu/memory` from accidental replacement. Existing mission-memory files require explicit authorization for destructive replacement, support append semantics, and optionally verify the expected SHA-256 before modification. The policy is enforced centrally by `ProtectedMemoryPolicy` and integrated into the PowerShell runtime write pipeline.

## Verification
- ProtectedMemoryPolicy tests: PASS
- Runtime integration tests: PASS
- FileOps integration tests: PASS
- Full compiled regression suite: PASS (68 test files)
