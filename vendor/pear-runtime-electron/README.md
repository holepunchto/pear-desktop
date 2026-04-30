# pear-runtime-electron (not official)

Reusable Electron + Pear Runtime plumbing extracted from the current `hello-pear-electron` pattern.

Keep Electron app concerns in the app: windows, menus, app lifecycle, deep links, CLI parsing. Put Pear runtime setup, update IPC, worker bridge channels, and renderer worker streams here.

## Install

```bash
npm i pear-runtime-electron # not yet
```

## Pieces

1. `pear-runtime-electron/runtime` - Pear Runtime storage/update/worker helpers
2. `pear-runtime-electron/main` - Electron main-process IPC helpers
3. `pear-runtime-electron/preload` - preload-safe bridge methods
4. `pear-runtime-electron/renderer` - stream-like renderer adapter for worker IPC

## Main process

This mirrors `hello-pear-electron/electron/main.js`, but keeps app-specific Electron wiring in the app.

```js
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { command, flag } from 'paparam'
import {
  bindPearUpdaterToWindow,
  createMainWorkerBridge,
  createPearRuntimeManager,
  getPackagedAppPath,
  registerPearUpdateHandlers
} from 'pear-runtime-electron'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = require('../package.json')
const appName = pkg.productName ?? pkg.name

const cmd = command(
  appName,
  flag('--storage <dir>', 'pass custom storage to pear-runtime'),
  flag('--no-updates', 'start without OTA updates')
)

cmd.parse(app.isPackaged ? process.argv.slice(1) : process.argv.slice(2))

if (cmd.flags.storage) app.setPath('userData', cmd.flags.storage)

ipcMain.on('pkg', (evt) => {
  evt.returnValue = pkg
})

const pear = createPearRuntimeManager({
  name: pkg.name,
  productName: pkg.productName,
  version: pkg.version,
  upgrade: pkg.upgrade,
  storage: cmd.flags.storage,
  updates: cmd.flags.updates,
  appPath: getPackagedAppPath({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    execPath: process.execPath
  })
})

const workerBridge = createMainWorkerBridge({
  ipcMain,
  app,
  getWindows: () => BrowserWindow.getAllWindows(),
  getPear: pear.getPear,
  resolveWorker: (specifier) => require.resolve('..' + specifier)
})

workerBridge.register()
registerPearUpdateHandlers({ ipcMain, app, getPear: pear.getPear })

async function createWindow() {
  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  bindPearUpdaterToWindow({ getPear: pear.getPear, window: win })

  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
}
```

## Preload

```js
const { contextBridge, ipcRenderer } = require('electron')
const { createPreloadBridge } = require('pear-runtime-electron/preload')

contextBridge.exposeInMainWorld('bridge', createPreloadBridge({ ipcRenderer }))
```

Exposed methods:

- `pkg()`
- `applyUpdate()`
- `appAfterUpdate()`
- `onPearEvent(name, listener)`
- `startWorker(specifier)`
- `onWorkerStdout(specifier, listener)`
- `onWorkerStderr(specifier, listener)`
- `onWorkerIPC(specifier, listener)`
- `onWorkerExit(specifier, listener)`
- `writeWorkerIPC(specifier, data)`

## Renderer worker stream

```js
import FramedStream from 'framed-stream'
import { BridgeWorkerStream } from 'pear-runtime-electron/renderer'

const worker = new BridgeWorkerStream({ specifier: '/workers/main.js' })
const pipe = new FramedStream(worker)

export function teardown() {
  pipe.destroy()
  worker.destroy()
}
```

## Worker pattern

Workers are run with `pear.run(resolvedWorker, [pear.storage])`, matching `hello-pear-electron`.

Inside the Bare worker:

```js
const Corestore = require('corestore')
const storage = Bare.argv[2]

Bare.IPC.on('data', (data) => console.log(data.toString()))
Bare.IPC.write('Hello from worker')

const store = new Corestore(storage)
```

## API

### `pear-runtime-electron/runtime`

- `createPearRuntimeManager({ name, productName?, version?, upgrade?, storage?, appPath?, updates? })`
- `getPackagedAppPath({ isPackaged, resourcesPath?, execPath?, appImage? })`
- `getDefaultPearDir({ appName, storage?, appPath?, tmpdir?, homedir? })`
- `createPearWorkerSpawner({ getPear, resolveWorker?, getWorkerArgs? })`
- `relaunchAfterUpdate({ app, argv?, appImage? })`

### `pear-runtime-electron/main`

- `createMainWorkerBridge({ ipcMain, app, getWindows, spawnWorker? })`
- `createMainWorkerBridge({ ipcMain, app, getWindows, getPear, resolveWorker?, getWorkerArgs? })`
- `bindPearUpdaterToWindow({ pear? getPear?, window, channels? })`
- `registerPearUpdateHandlers({ ipcMain, app, getPear, channels? })`

### `pear-runtime-electron/preload`

- `createPreloadBridge({ ipcRenderer, channels?, includePkg? })`

### `pear-runtime-electron/channels`

- `createChannels(prefix = 'pear')`
- `normalizeSpecifier(specifier)` normalizes `workers/main.js` to `/workers/main.js`

## Development

```bash
npm test
npm run lint
npm run format
```
