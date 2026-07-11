# AI Runtime State Machine v0.1

States:
- PLAN
- SEND_JOB
- WAIT_REPORT
- ANALYZE_REPORT
- WAIT_USER
- WAIT_CONNECTION
- FINISHED

Rules:
1. If Keynu connection is active, the AI must never terminate a response with explanation only.
2. Every execution cycle must end with exactly one of:
   - KAP JOB
   - WAIT_USER
   - WAIT_CONNECTION
3. After receiving a REPORT, AI analyzes it and immediately decides the next state.
4. A blocked job must not stop the runtime. The AI should switch to another runnable job.
5. Reports are checkpoints, not conversation endpoints.
