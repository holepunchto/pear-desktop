export function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data)
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data))
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  }
  if (typeof data === 'string') return Buffer.from(data)
  return Buffer.alloc(0)
}

export function toUint8Array(data) {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  }
  if (typeof data === 'string') return Buffer.from(data)
  return new Uint8Array(0)
}

export function dataLength(data) {
  if (data instanceof Uint8Array) return `bytes=${data.byteLength}`
  if (data instanceof ArrayBuffer) return `bytes=${data.byteLength}`
  if (ArrayBuffer.isView(data)) return `bytes=${data.byteLength}`
  if (typeof data === 'string') return `chars=${data.length}`
  return 'unknown-size'
}

export function toError(error, fallback = 'Unknown worker IPC error') {
  if (error instanceof Error) return error
  return new Error(typeof error === 'string' ? error : fallback)
}
