import { dataLength, toError, toUint8Array } from './binary.js'
import { normalizeSpecifier } from './channels.js'

const noop = () => {}

export class BridgeWorkerStream {
  constructor(options = {}) {
    const bridge = options.bridge ?? globalThis.window?.bridge
    if (!bridge) {
      throw new Error('window.bridge is unavailable; renderer must run inside Electron')
    }

    this.bridge = bridge
    this.specifier = normalizeSpecifier(options.specifier)
    this.debug = typeof options.debug === 'function' ? options.debug : noop
    this.listeners = new Map()
    this.pendingWrites = []
    this.offIPC = null
    this.offExit = null
    this.destroyed = false
    this.ready = false
    this.closed = false
    this.ipcCount = 0
    this.startPromise = null

    this.offIPC = this.bridge.onWorkerIPC(this.specifier, (data) => {
      this.ipcCount += 1
      this.debug(
        'worker ipc -> renderer',
        this.specifier,
        `message=${this.ipcCount}`,
        dataLength(data)
      )
      this.emit('data', toUint8Array(data))
    })

    this.offExit = this.bridge.onWorkerExit(this.specifier, (code) => {
      this.debug('worker exit event', this.specifier, code)
      this.destroy()
    })

    if (options.autoStart !== false) {
      void this.start()
    }
  }

  start() {
    if (this.startPromise) return this.startPromise

    this.startPromise = Promise.resolve(this.bridge.startWorker(this.specifier))
      .then(() => {
        if (this.destroyed) return
        this.ready = true
        this.debug('startWorker ok', this.specifier)
        this.flushPendingWrites()
      })
      .catch((error) => {
        this.debug('startWorker failed', this.specifier, error)
        this.destroy(toError(error))
      })

    return this.startPromise
  }

  on(event, listener) {
    let bucket = this.listeners.get(event)
    if (!bucket) {
      bucket = new Set()
      this.listeners.set(event, bucket)
    }
    bucket.add(listener)
    return this
  }

  off(event, listener) {
    const bucket = this.listeners.get(event)
    bucket?.delete(listener)
    return this
  }

  removeListener(event, listener) {
    return this.off(event, listener)
  }

  pause() {
    return this
  }

  resume() {
    return this
  }

  write(data) {
    if (this.destroyed) return false

    const payload = toUint8Array(data)

    if (!this.ready) {
      this.pendingWrites.push(payload)
      return true
    }

    this.debug('renderer -> worker ipc', this.specifier, `bytes=${payload.byteLength}`)
    this.writeNow(payload)
    return true
  }

  destroy(error) {
    if (this.destroyed) return this

    this.destroyed = true
    this.closed = true

    if (this.offIPC) {
      this.offIPC()
      this.offIPC = null
    }

    if (this.offExit) {
      this.offExit()
      this.offExit = null
    }

    this.pendingWrites = []

    if (error) {
      this.emit('error', toError(error))
    }

    this.emit('end')
    this.emit('close')
    this.listeners.clear()

    return this
  }

  writeNow(payload) {
    void Promise.resolve(this.bridge.writeWorkerIPC(this.specifier, payload)).catch((error) => {
      this.debug('writeWorkerIPC failed', this.specifier, error)
      this.emit('error', toError(error))
    })
  }

  flushPendingWrites() {
    if (!this.ready || this.destroyed) return

    const writes = this.pendingWrites
    this.pendingWrites = []

    for (const payload of writes) {
      this.debug('renderer -> worker ipc', this.specifier, `bytes=${payload.byteLength}`)
      this.writeNow(payload)
    }
  }

  emit(event, value) {
    const bucket = this.listeners.get(event)
    if (!bucket || bucket.size === 0) return
    for (const listener of bucket) {
      listener(value)
    }
  }
}

export function createBridgeWorkerStream(options) {
  return new BridgeWorkerStream(options)
}
