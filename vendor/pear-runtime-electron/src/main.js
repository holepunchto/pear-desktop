import { toBuffer } from './binary.js'
import { createChannels, normalizeSpecifier } from './channels.js'
import { createPearWorkerSpawner, relaunchAfterUpdate } from './runtime.js'

const noop = () => {}

function sendToAllWindows(getWindows, channel, data) {
  for (const win of getWindows()) {
    if (!win || typeof win.isDestroyed !== 'function') continue
    if (win.isDestroyed()) continue
    if (!win.webContents || typeof win.webContents.send !== 'function') continue
    win.webContents.send(channel, data)
  }
}

export function createMainWorkerBridge(options = {}) {
  const {
    ipcMain,
    app,
    getWindows,
    spawnWorker,
    getPear,
    resolveWorker,
    getWorkerArgs,
    channels = createChannels('pear'),
    normalize = normalizeSpecifier,
    onStartWorker = noop,
    onWorkerStdout = noop,
    onWorkerStderr = noop,
    onWorkerIPC = noop,
    onRendererWrite = noop,
    onWorkerExit = noop
  } = options

  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new Error('ipcMain with .handle is required')
  }
  if (!app || typeof app.on !== 'function' || typeof app.removeListener !== 'function') {
    throw new Error('Electron app is required')
  }
  if (typeof getWindows !== 'function') {
    throw new Error('getWindows function is required')
  }
  const spawn =
    typeof spawnWorker === 'function'
      ? spawnWorker
      : createPearWorkerSpawner({ getPear, resolveWorker, getWorkerArgs })

  const workers = new Map()
  let registered = false

  function getWorker(inputSpecifier) {
    const specifier = normalize(inputSpecifier)
    if (workers.has(specifier)) return workers.get(specifier)

    const worker = spawn(specifier)

    const sendWorkerStdout = (data) => {
      onWorkerStdout(specifier, data)
      sendToAllWindows(getWindows, channels.worker.stdout(specifier), data)
    }

    const sendWorkerStderr = (data) => {
      onWorkerStderr(specifier, data)
      sendToAllWindows(getWindows, channels.worker.stderr(specifier), data)
    }

    const sendWorkerIPC = (data) => {
      onWorkerIPC(specifier, data)
      sendToAllWindows(getWindows, channels.worker.ipc(specifier), data)
    }

    ipcMain.handle(channels.worker.writeIPC(specifier), (event, data) => {
      const payload = toBuffer(data)
      onRendererWrite(specifier, payload)
      return worker.write(payload)
    })

    const onBeforeQuit = () => {
      if (!worker.destroyed) worker.destroy()
    }

    workers.set(specifier, worker)

    worker.on('data', sendWorkerIPC)
    worker.stdout.on('data', sendWorkerStdout)
    worker.stderr.on('data', sendWorkerStderr)

    worker.once('exit', (code) => {
      app.removeListener('before-quit', onBeforeQuit)
      ipcMain.removeHandler(channels.worker.writeIPC(specifier))
      worker.removeListener('data', sendWorkerIPC)
      worker.stdout.removeListener('data', sendWorkerStdout)
      worker.stderr.removeListener('data', sendWorkerStderr)
      onWorkerExit(specifier, code)
      sendToAllWindows(getWindows, channels.worker.exit(specifier), code)
      workers.delete(specifier)
    })

    app.on('before-quit', onBeforeQuit)

    return worker
  }

  function startWorker(inputSpecifier) {
    const specifier = normalize(inputSpecifier)
    onStartWorker(specifier)
    getWorker(specifier)
    return true
  }

  function register() {
    if (registered) return
    ipcMain.handle(channels.worker.start, (event, specifier) => {
      return startWorker(specifier)
    })
    registered = true
  }

  function unregister() {
    if (!registered) return
    ipcMain.removeHandler(channels.worker.start)
    registered = false
  }

  function dispose() {
    unregister()
    for (const worker of workers.values()) {
      try {
        if (!worker.destroyed) worker.destroy()
      } catch {}
    }
    workers.clear()
  }

  return {
    channels,
    getWorker,
    startWorker,
    register,
    unregister,
    dispose
  }
}

export function bindPearUpdaterToWindow(options = {}) {
  const { pear, getPear, window, channels = createChannels('pear') } = options
  const runtime = pear ?? getPear?.()

  if (!runtime?.updater) throw new Error('Pear runtime with .updater is required')
  if (!window || typeof window.on !== 'function') throw new Error('Electron window is required')

  const send = (name) => {
    if (typeof window.isDestroyed === 'function' && window.isDestroyed()) return
    window.webContents.send(channels.event(name))
  }

  const onUpdating = () => send('updating')
  const onUpdated = () => send('updated')

  runtime.updater.on('updating', onUpdating)
  runtime.updater.on('updated', onUpdated)

  const cleanup = () => {
    runtime.updater.removeListener('updating', onUpdating)
    runtime.updater.removeListener('updated', onUpdated)
  }

  window.on('closed', cleanup)
  return cleanup
}

export function registerPearUpdateHandlers(options = {}) {
  const { ipcMain, app, getPear, channels = createChannels('pear') } = options

  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new Error('ipcMain with .handle is required')
  }
  if (typeof getPear !== 'function') throw new Error('getPear function is required')

  ipcMain.handle(channels.update.apply, () => {
    const pear = getPear()
    return pear.updater.applyUpdate()
  })

  ipcMain.handle(channels.update.after, () => relaunchAfterUpdate({ app }))

  return () => {
    ipcMain.removeHandler(channels.update.apply)
    ipcMain.removeHandler(channels.update.after)
  }
}
