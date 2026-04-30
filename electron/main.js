import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { parseLaunchArgs } from './launch-args.js'
import {
  bindPearUpdaterToWindow,
  createMainWorkerBridge,
  createPearRuntimeManager,
  getPackagedAppPath,
  registerPearUpdateHandlers
} from 'pear-runtime-electron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const { name, productName, version, upgrade } = pkg

const protocol = name

const { storage: pearStore, updates } = parseLaunchArgs(process.argv, {
  isPackaged: app.isPackaged
})

if (pearStore) app.setPath('userData', pearStore)

ipcMain.on('pkg', (evt) => {
  evt.returnValue = pkg
})

const pearManager = createPearRuntimeManager({
  name,
  productName,
  version,
  upgrade,
  storage: pearStore,
  updates,
  appPath: getPackagedAppPath({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    execPath: process.execPath
  })
})

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
  const runtime = pearManager.getPear()
  if (typeof runtime.ready === 'function') {
    try {
      await runtime.ready()
    } catch {}
  }

  const swarm = pearManager.swarm || runtime.swarm || null
  const dht = swarm?.dht || null
  const store = pearManager.store || runtime.store || null

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

const workerControls = new Map()
let workerBridge = null

function getWorkerControl(specifier) {
  let control = workerControls.get(specifier)
  if (control) return control

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
      const worker = workerBridge.getWorker(specifier)
      worker.write(Buffer.from(JSON.stringify({ type: 'runtime:stats', stats }) + '\n'))
    } catch (error) {
      const worker = workerBridge.getWorker(specifier)
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

  function parse(data) {
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

  control = { parse, destroy: clearStatsTimer }
  workerControls.set(specifier, control)
  return control
}

workerBridge = createMainWorkerBridge({
  ipcMain,
  app,
  getWindows: () => BrowserWindow.getAllWindows(),
  getPear: pearManager.getPear,
  resolveWorker: (specifier) => path.resolve(__dirname, '..' + specifier),
  onWorkerIPC(specifier, data) {
    getWorkerControl(specifier).parse(data)
  },
  onWorkerExit(specifier) {
    const control = workerControls.get(specifier)
    if (control) control.destroy()
    workerControls.delete(specifier)
  }
})

workerBridge.register()
registerPearUpdateHandlers({ ipcMain, app, getPear: pearManager.getPear })

app.once('before-quit', () => {
  workerBridge.dispose()
  pearManager.close()
})

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

  bindPearUpdaterToWindow({ getPear: pearManager.getPear, window: win })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url).catch((err) => {
        console.error('Failed to open external URL:', err)
      })
    }

    return { action: 'deny' }
  })

  const devServerUrl = process.env.PEAR_DEV_SERVER_URL

  if (devServerUrl) {
    await win.loadURL(devServerUrl)
    win.webContents.openDevTools()
    return
  }

  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

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
