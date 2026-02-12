import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const PearRuntime = require('pear-runtime')
const pearConfig = require('../pear.json')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
let runtime = null
let worker = null

function getRuntime() {
  if (runtime) return runtime
  runtime = new PearRuntime({ app: getAppPath(), ...pearConfig })
  return runtime
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
    width: 800,
    height: 600,
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
