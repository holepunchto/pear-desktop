# Pear Desktop Stats Plan

## Goal

Keep `pear-desktop` as a devtool surface that exposes runtime internals for Pear development, with phase 1 implemented and retained.

## Phase 1: Runtime Stats (active)

Expose through `runtime:getStats`:

- `swarm`
  - `connections`
  - `peers`
  - `connecting`
  - `stats`
- `dht`
  - `bootstrap`
  - `knownNodes`
  - `stats`
  - `bootstrapped`
- `corestore`
  - `loadedCores`
  - `persistedCores`
  - `loadedCoreDiscoveryKeys` (sample)
  - `persistedCoreDiscoveryKeys` (sample)

Current implementation notes:

- Main-process endpoint in `electron/main.js` collects from `PearRuntime`.
- Exposed to renderer in `electron/preload.js` via `window.bridge.getStats()`.
- Primary dashboard UI in `renderer/app.jsx`.

## Out of scope for this phase

- IPC command-level enumeration
- Transfer progress telemetry (`peers`, `speeds`, `percent`)
