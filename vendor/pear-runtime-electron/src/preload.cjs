function normalizeSpecifier(specifier) {
  if (typeof specifier !== 'string' || specifier.length === 0) {
    throw new Error('Worker specifier must be a non-empty string')
  }
  return specifier.startsWith('/') ? specifier : '/' + specifier
}

function createChannels(prefix = 'pear') {
  const root = String(prefix || 'pear')
  return {
    pkg: 'pkg',
    update: {
      apply: root + ':applyUpdate',
      after: 'app:afterUpdate'
    },
    worker: {
      start: root + ':startWorker',
      stdout: (specifier) => root + ':worker:stdout:' + normalizeSpecifier(specifier),
      stderr: (specifier) => root + ':worker:stderr:' + normalizeSpecifier(specifier),
      ipc: (specifier) => root + ':worker:ipc:' + normalizeSpecifier(specifier),
      exit: (specifier) => root + ':worker:exit:' + normalizeSpecifier(specifier),
      writeIPC: (specifier) => root + ':worker:writeIPC:' + normalizeSpecifier(specifier)
    },
    event: (name) => root + ':event:' + name
  }
}

function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data)
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data))
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  }
  if (typeof data === 'string') return Buffer.from(data)
  return Buffer.alloc(0)
}

function createPreloadBridge(options = {}) {
  const { ipcRenderer, channels = createChannels('pear'), includePkg = true } = options
  const pkgChannel = channels.pkg

  if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') {
    throw new Error('ipcRenderer with .invoke is required')
  }

  const bridge = {
    applyUpdate() {
      return ipcRenderer.invoke(channels.update.apply)
    },
    appAfterUpdate() {
      return ipcRenderer.invoke(channels.update.after)
    },
    onPearEvent(name, listener) {
      const channel = channels.event(name)
      const wrap = (event, value) => listener(value ?? name)
      ipcRenderer.on(channel, wrap)
      return () => ipcRenderer.removeListener(channel, wrap)
    },
    startWorker(specifier) {
      return ipcRenderer.invoke(channels.worker.start, normalizeSpecifier(specifier))
    },
    onWorkerStdout(specifier, listener) {
      const normalized = normalizeSpecifier(specifier)
      const channel = channels.worker.stdout(normalized)
      const wrap = (event, data) => listener(toBuffer(data))
      ipcRenderer.on(channel, wrap)
      return () => ipcRenderer.removeListener(channel, wrap)
    },
    onWorkerStderr(specifier, listener) {
      const normalized = normalizeSpecifier(specifier)
      const channel = channels.worker.stderr(normalized)
      const wrap = (event, data) => listener(toBuffer(data))
      ipcRenderer.on(channel, wrap)
      return () => ipcRenderer.removeListener(channel, wrap)
    },
    onWorkerIPC(specifier, listener) {
      const normalized = normalizeSpecifier(specifier)
      const channel = channels.worker.ipc(normalized)
      const wrap = (event, data) => listener(toBuffer(data))
      ipcRenderer.on(channel, wrap)
      return () => ipcRenderer.removeListener(channel, wrap)
    },
    onWorkerExit(specifier, listener) {
      const normalized = normalizeSpecifier(specifier)
      const channel = channels.worker.exit(normalized)
      const wrap = (event, code) => listener(code)
      ipcRenderer.on(channel, wrap)
      return () => ipcRenderer.removeListener(channel, wrap)
    },
    writeWorkerIPC(specifier, data) {
      return ipcRenderer.invoke(channels.worker.writeIPC(specifier), toBuffer(data))
    }
  }

  if (includePkg) {
    bridge.pkg = () => ipcRenderer.sendSync(pkgChannel)
  }

  return bridge
}

module.exports = {
  createChannels,
  normalizeSpecifier,
  toBuffer,
  createPreloadBridge
}
