import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const PearRuntime = require('pear-runtime')
const pearConfig = require('../package.json')
const { version, upgrade } = pearConfig

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let runtime = null
let worker = null

function getRuntime() {
  if (runtime) return runtime
  runtime = new PearRuntime({ app: getAppPath(), version, upgrade })
  return runtime
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
  const runtime = getRuntime()
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

function getAppPath() {
  if (process.cwd() !== '/') return null
  return path.join(process.resourcesPath, '..', '..')
}

function emitWorkerData(data) {
  const text = data.toString()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('worker:data', text)
  }
}

function getWorker() {
  if (worker) return worker
  worker = getRuntime().run(require.resolve('../worker/bare.js'))
  worker.stdout.on('data', emitWorkerData)
  worker.once('exit', () => {
    worker.stdout.removeListener('data', emitWorkerData)
    worker = null
  })
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

  const runtime = getRuntime()

  const onUpdating = () => {
    if (!win.isDestroyed()) win.webContents.send('runtime:event', 'updating')
  }

  const onUpdated = () => {
    if (!win.isDestroyed()) win.webContents.send('runtime:event', 'updated')
  }

  runtime.on('updating', onUpdating)
  runtime.on('updated', onUpdated)

  win.on('closed', () => {
    runtime.removeListener('updating', onUpdating)
    runtime.removeListener('updated', onUpdated)
  })

  const devServerUrl = process.env.PEAR_DEV_SERVER_URL

  if (devServerUrl) {
    await win.loadURL(devServerUrl)
    win.webContents.openDevTools()
    return
  }

  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

ipcMain.handle('runtime:applyUpdate', () => getRuntime().applyUpdate())
ipcMain.handle('runtime:getConfig', () => pearConfig)
ipcMain.handle('runtime:getStats', () => getRuntimeStats())
ipcMain.handle('runtime:startWorker', () => {
  getWorker()
  return true
})

app.whenReady().then(() => {
  createWindow().catch((error) => {
    console.error('Failed to create window:', error)
    app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => {
        console.error('Failed to create window:', error)
      })
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
