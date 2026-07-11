# KAOS Event Bus

The Event Bus is the communication backbone of KAOS.

Goals:

- Remove direct dependencies between services.
- Allow plugins to subscribe to lifecycle events.
- Enable logging, monitoring, automation and AI observers.

Core events:

- kernel.boot
- kernel.ready
- kernel.shutdown
- runtime.job.started
- runtime.job.finished
- browser.message.received
- browser.report.sent
- dashboard.refresh
- memory.updated
- workspace.changed

Future:

- wildcard subscriptions
- async queues
- persistent event history
- remote event streaming
