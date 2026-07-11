# KAOS-018 Commands Target

Status: Implemented in source, requires BrowserAgent restart to activate in the running bridge.

The running BrowserAgent process still uses the old routing path until restarted. Source build passes after adding target=commands support through routeKapJob().

Validation:
- npm run build: passing
- target=powershell: working
- target=commands: source implemented, runtime process restart required
