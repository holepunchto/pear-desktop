export function parseLaunchArgs(argv, { isPackaged = false } = {}) {
  const args = isPackaged ? argv.slice(1) : argv.slice(2)
  const flags = {
    storage: undefined,
    updates: true
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--no-updates') {
      flags.updates = false
      continue
    }

    if (arg === '--storage') {
      flags.storage = args[i + 1]
      i++
      continue
    }

    if (arg.startsWith('--storage=')) {
      flags.storage = arg.slice('--storage='.length)
    }
  }

  return flags
}
