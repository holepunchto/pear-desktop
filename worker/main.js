const DEFAULT_INTERVAL_MS = 2000

function send(message) {
  Bare.IPC.write(JSON.stringify(message) + '\n')
}

let buffer = ''

Bare.IPC.on('data', (data) => {
  buffer += data.toString()

  let boundary = buffer.indexOf('\n')
  while (boundary !== -1) {
    const line = buffer.slice(0, boundary).trim()
    buffer = buffer.slice(boundary + 1)
    boundary = buffer.indexOf('\n')

    if (!line) continue

    let message = null
    try {
      message = JSON.parse(line)
    } catch {
      continue
    }

    if (message?.type === 'runtime:stats') {
      send(message)
    }

    if (message?.type === 'runtime:stats:error') {
      send(message)
    }
  }
})

send({
  type: 'runtime:stats:subscribe',
  interval: DEFAULT_INTERVAL_MS,
  storage: Bare.argv[2] ?? null
})
