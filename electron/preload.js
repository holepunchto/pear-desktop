const { contextBridge, ipcRenderer } = require('electron')

function normalizeSpecifier(specifier) {
  if (typeof specifier !== 'string' || specifier.length === 0) {
    throw new Error('Worker specifier must be a non-empty string')
  }
  return specifier.startsWith('/') ? specifier : '/' + specifier
}

function toBinary(data) {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  if (typeof data === 'string') return new TextEncoder().encode(data)
  return new Uint8Array(0)
}

function listen(channel, listener) {
  const wrap = (evt, value) => listener(value)
  ipcRenderer.on(channel, wrap)
  return () => ipcRenderer.removeListener(channel, wrap)
}

function workerChannel(event, specifier) {
  return `pear:worker:${event}:${normalizeSpecifier(specifier)}`
}

contextBridge.exposeInMainWorld('bridge', {
  pkg() {
    return ipcRenderer.sendSync('pkg')
  },
  applyUpdate() {
    return ipcRenderer.invoke('pear:applyUpdate')
  },
  appAfterUpdate() {
    return ipcRenderer.invoke('app:afterUpdate')
  },
  onPearEvent(name, listener) {
    return listen(`pear:event:${name}`, (value) => listener(value ?? name))
  },
  startWorker(specifier) {
    return ipcRenderer.invoke('pear:startWorker', normalizeSpecifier(specifier))
  },
  onWorkerStdout(specifier, listener) {
    return listen(workerChannel('stdout', specifier), (data) => listener(toBinary(data)))
  },
  onWorkerStderr(specifier, listener) {
    return listen(workerChannel('stderr', specifier), (data) => listener(toBinary(data)))
  },
  onWorkerIPC(specifier, listener) {
    return listen(workerChannel('ipc', specifier), (data) => listener(toBinary(data)))
  },
  onWorkerExit(specifier, listener) {
    return listen(workerChannel('exit', specifier), listener)
  },
  writeWorkerIPC(specifier, data) {
    return ipcRenderer.invoke(workerChannel('writeIPC', specifier), toBinary(data))
  }
})
