# Keynu Continuation Delivery

Status: Implemented foundation
Version: 0.1

## Purpose

The continuation delivery layer safely sends AI continuation requests without producing duplicate messages.

## Persistence

Every request is stored under:

`.keynu/missions/continuation-deliveries/<request-id>.json`

## Lifecycle

1. Build a deterministic continuation request.
2. Reject the request when continuation policy does not permit AI work.
3. Reserve the request identifier before delivery.
4. Record an attempt before calling the browser sender.
5. Mark the request as delivered after successful transmission.
6. Record failure details when transmission fails.
7. Permit retry of failed or pending requests.
8. Suppress requests already marked as delivered.

## Delivery States

- `PENDING`
- `DELIVERED`
- `FAILED`

## Safety

Request, mission, and resume-token identifiers are validated before being used as file paths.

Atomic temporary-file replacement prevents partially written delivery records.

## BrowserAgent Integration

After a verified KAP report is sent, BrowserAgent will create a `WAITING_AI` continuation contract and call `ContinuationDeliveryService.deliver`.

The browser conversation sender is supplied as a callback, keeping the continuation service independent from Playwright and browser implementation details.
