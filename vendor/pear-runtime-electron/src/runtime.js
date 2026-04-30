import os from 'os'
import path from 'path'

import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import PearRuntime from 'pear-runtime'
import { isLinux, isMac, isWindows } from 'which-runtime'

export function getPackagedAppPath(options = {}) {
  const {
    isPackaged = false,
    appImage = process.env.APPIMAGE,
    execPath = process.execPath,
    resourcesPath = process.resourcesPath
  } = options

  if (!isPackaged) return null
  if (isLinux && appImage) return appImage
  if (isWindows) return execPath
  return path.join(resourcesPath, '..', '..')
}

export function getPlatformAppExtension() {
  return isLinux ? '.AppImage' : isMac ? '.app' : '.msix'
}

export function getDefaultPearDir(options = {}) {
  const { appName, storage, appPath = null, tmpdir = os.tmpdir(), homedir = os.homedir() } = options

  if (!appName) throw new Error('appName is required')
  if (storage) return storage
  if (appPath === null) return path.join(tmpdir, 'pear', appName)

  if (isMac) return path.join(homedir, 'Library', 'Application Support', appName)
  if (isLinux) return path.join(homedir, '.config', appName)
  return path.join(homedir, 'AppData', 'Local', appName)
}

export function createPearRuntimeManager(options = {}) {
  const {
    name,
    productName,
    version,
    upgrade,
    storage,
    appPath = null,
    updates = true,
    onError = console.error,
    Corestore: CorestoreClass = Corestore,
    Hyperswarm: HyperswarmClass = Hyperswarm,
    PearRuntime: PearRuntimeClass = PearRuntime
  } = options

  const appName = productName ?? name
  if (!appName) throw new Error('name or productName is required')

  let pear = null
  let dir = null
  let store = null
  let swarm = null

  function getPear() {
    if (pear) return pear

    dir = getDefaultPearDir({ appName, storage, appPath })
    store = new CorestoreClass(path.join(dir, 'pear-runtime/corestore'))
    swarm = new HyperswarmClass()

    pear = new PearRuntimeClass({
      dir,
      app: appPath,
      updates,
      version,
      upgrade,
      name: appName + getPlatformAppExtension(),
      store,
      swarm
    })

    if (updates !== false) {
      swarm.on('connection', (connection) => store.replicate(connection))
      swarm.join(pear.updater.drive.core.discoveryKey, {
        client: true,
        server: false
      })
    }

    if (typeof pear.on === 'function') pear.on('error', onError)
    return pear
  }

  function close() {
    if (pear && typeof pear.close === 'function') pear.close()
    if (swarm && typeof swarm.destroy === 'function') swarm.destroy()
    if (store && typeof store.close === 'function') store.close()
    pear = null
    dir = null
    store = null
    swarm = null
  }

  return {
    get dir() {
      return dir
    },
    get store() {
      return store
    },
    get swarm() {
      return swarm
    },
    getPear,
    getRuntime: getPear,
    close
  }
}

export function createPearWorkerSpawner(options = {}) {
  const {
    getPear,
    resolveWorker = (specifier) => specifier,
    getWorkerArgs = (pear) => [pear.storage]
  } = options

  if (typeof getPear !== 'function') throw new Error('getPear function is required')

  return (specifier) => {
    const pear = getPear()
    return pear.run(resolveWorker(specifier), getWorkerArgs(pear, specifier))
  }
}

export function relaunchAfterUpdate(options = {}) {
  const { app, argv = process.argv, appImage = process.env.APPIMAGE } = options

  if (!app || typeof app.relaunch !== 'function' || typeof app.exit !== 'function') {
    throw new Error('Electron app with .relaunch and .exit is required')
  }

  if (isLinux && appImage) {
    app.relaunch({
      execPath: appImage,
      args: [
        '--appimage-extract-and-run',
        ...argv.slice(1).filter((arg) => arg !== '--appimage-extract-and-run')
      ]
    })
  } else if (!isWindows) {
    app.relaunch()
  }

  app.exit(0)
}
