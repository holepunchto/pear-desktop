import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import PearRuntime from 'pear-runtime'
import { isMac, isLinux } from 'which-runtime'
import { command, flag } from 'paparam'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const { name, productName, version, upgrade } = pkg

const protocol = name

const workers = new Map()
let pear = null

const appName = productName ?? name

const cmd = command(
  appName,
  flag('--storage', 'pass custom storage to pear-runtime'),
  flag('--no-updates', 'start without OTA updates')
)

cmd.parse(app.isPackaged ? process.argv.slice(1) : process.argv.slice(2))

const pearStore = cmd.flags.storage
const updates = cmd.flags.updates

ipcMain.on('pkg', (evt) => {
  evt.returnValue = pkg
})

function getPear() {
  if (pear) return pear
  const appPath = getAppPath()
  let dir = null
  if (pearStore) {
    console.log('pear store: ' + pearStore)
    dir = pearStore
  } else if (appPath === null) {
    dir = path.join(os.tmpdir(), 'pear', appName)
  } else {
    dir = isMac
      ? path.join(os.homedir(), 'Library', 'Application Support', appName)
      : isLinux
        ? path.join(os.homedir(), '.config', appName)
        : path.join(os.homedir(), 'AppData', 'Roaming', appName)
  }
  pear = new PearRuntime({ dir, app: appPath, updates, version, upgrade })
  return pear
}

function getAppPath() {
  if (!app.isPackaged) return null
  if (isLinux && process.env.APPIMAGE) return process.env.APPIMAGE
  return path.join(process.resourcesPath, '..', '..')
}

function sendToAll(name, data) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(name, data)
  }
}

function normalizeNode(node) {
  if (!node || typeof node !== 'object') return null
  const out = {
    host: node.host ?? null,
    port: Number.isInteger(node.port) ? node.port : null
  }
  if (node.id && Buffer.isBuffer(node.id)) out.id = node.id.toString('hex')
  return out
}

async function getPersistedCoreStats(store, limit = 50) {
  if (!store || typeof store.list !== 'function') {
    return { count: null, discoveryKeys: [] }
  }

  const stream = store.list()
  let count = 0
  const discoveryKeys = []

  try {
    for await (const discoveryKey of stream) {
      count++
      if (discoveryKeys.length < limit) {
        discoveryKeys.push(Buffer.from(discoveryKey).toString('hex'))
      }
    }
  } catch (error) {
    return {
      count: null,
      discoveryKeys,
      error: error?.message || 'Failed to enumerate persisted cores'
    }
  } finally {
    if (stream && typeof stream.destroy === 'function') stream.destroy()
  }

  return { count, discoveryKeys }
}

async function getRuntimeStats() {
  const runtime = getPear()
  if (typeof runtime.ready === 'function') {
    try {
      await runtime.ready()
    } catch {}
  }

  const swarm = runtime.swarm || null
  const dht = swarm?.dht || null
  const store = runtime.store || null

  const loadedCoreDiscoveryKeys = []
  if (store?.cores && Symbol.iterator in Object(store.cores)) {
    for (const core of store.cores) {
      if (loadedCoreDiscoveryKeys.length >= 50) break
      if (!core?.discoveryKey) continue
      loadedCoreDiscoveryKeys.push(Buffer.from(core.discoveryKey).toString('hex'))
    }
  }

  const persisted = await getPersistedCoreStats(store)

  const bootstrap = Array.isArray(dht?.bootstrapNodes)
    ? dht.bootstrapNodes.map(normalizeNode).filter(Boolean)
    : []

  const knownNodes =
    typeof dht?.toArray === 'function' ? dht.toArray({ limit: 100 }).map(normalizeNode) : []

  return {
    timestamp: Date.now(),
    link: runtime.link ?? null,
    swarm: {
      connections: swarm?.connections?.size ?? 0,
      peers: swarm?.peers?.size ?? 0,
      connecting: swarm?.connecting ?? 0,
      stats: swarm?.stats ?? null
    },
    dht: {
      bootstrap,
      knownNodes,
      stats: dht?.stats ?? null,
      bootstrapped: typeof dht?.bootstrapped === 'boolean' ? dht.bootstrapped : null
    },
    corestore: {
      loadedCores: typeof store?.cores?.size === 'number' ? store.cores.size : null,
      loadedCoreDiscoveryKeys,
      persistedCores: persisted.count,
      persistedCoreDiscoveryKeys: persisted.discoveryKeys,
      persistedError: persisted.error ?? null
    }
  }
}

function getWorker(specifier) {
  if (workers.has(specifier)) return workers.get(specifier)
  const pear = getPear()
  const worker = pear.run(path.resolve(__dirname, '..' + specifier), [pear.storage])
  let commandBuffer = ''
  let statsTimer = null
  let statsInFlight = false

  function clearStatsTimer() {
    if (statsTimer) {
      clearInterval(statsTimer)
      statsTimer = null
    }
  }

  async function sendRuntimeStats() {
    if (statsInFlight) return
    statsInFlight = true
    try {
      const stats = await getRuntimeStats()
      worker.write(Buffer.from(JSON.stringify({ type: 'runtime:stats', stats }) + '\n'))
    } catch (error) {
      worker.write(
        Buffer.from(
          JSON.stringify({
            type: 'runtime:stats:error',
            error: error?.message || 'Failed to collect runtime stats'
          }) + '\n'
        )
      )
    } finally {
      statsInFlight = false
    }
  }

  function handleWorkerControlMessage(message) {
    if (!message || typeof message !== 'object') return
    switch (message.type) {
      case 'runtime:stats:subscribe': {
        const interval = Math.max(500, Number(message.interval) || 2000)
        clearStatsTimer()
        void sendRuntimeStats()
        statsTimer = setInterval(() => {
          void sendRuntimeStats()
        }, interval)
        break
      }
      case 'runtime:stats:unsubscribe': {
        clearStatsTimer()
        break
      }
      default:
        break
    }
  }

  function parseWorkerControlMessages(data) {
    commandBuffer += data.toString()
    let boundary = commandBuffer.indexOf('\n')
    while (boundary !== -1) {
      const line = commandBuffer.slice(0, boundary).trim()
      commandBuffer = commandBuffer.slice(boundary + 1)
      boundary = commandBuffer.indexOf('\n')
      if (!line) continue
      try {
        handleWorkerControlMessage(JSON.parse(line))
      } catch {}
    }
  }

  function sendWorkerStdout(data) {
    sendToAll('pear:worker:stdout:' + specifier, data)
  }
  function sendWorkerStderr(data) {
    sendToAll('pear:worker:stderr:' + specifier, data)
  }
  function sendWorkerIPC(data) {
    parseWorkerControlMessages(data)
    sendToAll('pear:worker:ipc:' + specifier, data)
  }
  ipcMain.handle('pear:worker:writeIPC:' + specifier, (evt, data) => {
    return worker.write(Buffer.from(data))
  })
  const onBeforeQuit = () => {
    if (!worker.destroyed) worker.destroy()
  }
  workers.set(specifier, worker)
  worker.on('data', sendWorkerIPC)
  worker.stdout.on('data', sendWorkerStdout)
  worker.stderr.on('data', sendWorkerStderr)
  worker.once('exit', (code) => {
    clearStatsTimer()
    app.removeListener('before-quit', onBeforeQuit)
    ipcMain.removeHandler('pear:worker:writeIPC:' + specifier)
    worker.removeListener('data', sendWorkerIPC)
    worker.stdout.removeListener('data', sendWorkerStdout)
    worker.stderr.removeListener('data', sendWorkerStderr)
    sendToAll('pear:worker:exit:' + specifier, code)
    workers.delete(specifier)
  })
  app.on('before-quit', onBeforeQuit)
  return worker
}

nativeTheme.themeSource = 'dark'

async function createWindow() {
  const win = new BrowserWindow({
    width: 1140,
    height: 910,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  const pear = getPear()

  const onUpdating = () => {
    if (!win.isDestroyed()) win.webContents.send('pear:event:updating')
  }

  const onUpdated = () => {
    if (!win.isDestroyed()) win.webContents.send('pear:event:updated')
  }

  pear.on('updating', onUpdating)
  pear.on('updated', onUpdated)

  win.on('closed', () => {
    pear.removeListener('updating', onUpdating)
    pear.removeListener('updated', onUpdated)
  })

  const devServerUrl = process.env.PEAR_DEV_SERVER_URL

  if (devServerUrl) {
    await win.loadURL(devServerUrl)
    win.webContents.openDevTools()
    return
  }

  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

ipcMain.handle('pear:applyUpdate', () => getPear().applyUpdate())
ipcMain.handle('pear:startWorker', (evt, filename) => {
  getWorker(filename)
  return true
})

function handleDeepLink(url) {
  console.log('deep link:', url)
}

app.setAsDefaultProtocolClient(protocol)

app.on('open-url', (evt, url) => {
  evt.preventDefault()
  handleDeepLink(url)
})

const lock = app.requestSingleInstanceLock()

if (!lock) {
  app.quit()
} else {
  app.on('second-instance', (evt, args) => {
    const url = args.find((arg) => arg.startsWith(protocol + '://'))
    if (url) handleDeepLink(url)
  })

  app.whenReady().then(() => {
    createWindow().catch((err) => {
      console.error('Failed to create window:', err)
      app.quit()
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow().catch((err) => {
          console.error('Failed to create window:', err)
        })
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
