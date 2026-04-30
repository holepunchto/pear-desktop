export function normalizeSpecifier(specifier) {
  if (typeof specifier !== 'string' || specifier.length === 0) {
    throw new Error('Worker specifier must be a non-empty string')
  }
  return specifier.startsWith('/') ? specifier : '/' + specifier
}

export function createChannels(prefix = 'pear') {
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
