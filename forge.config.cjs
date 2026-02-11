const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

function removeNonTargetPrebuilds(buildPath, platform, arch) {
  const keep = new Set([`${platform}-${arch}`, `${platform}-universal`])
  const nodeModulesPath = path.join(buildPath, 'node_modules')
  if (!fs.existsSync(nodeModulesPath)) return

  const stack = [nodeModulesPath]
  while (stack.length > 0) {
    const dir = stack.pop()
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const entryPath = path.join(dir, entry.name)
      if (entry.name === 'prebuilds') {
        for (const prebuildEntry of fs.readdirSync(entryPath, { withFileTypes: true })) {
          if (!prebuildEntry.isDirectory()) continue
          if (keep.has(prebuildEntry.name)) continue
          fs.rmSync(path.join(entryPath, prebuildEntry.name), { recursive: true, force: true })
        }
        continue
      }
      stack.push(entryPath)
    }
  }
}

module.exports = {
  packagerConfig: {
    prune: true,
    ignore: [/^\/\.github($|\/)/, /^\/tests($|\/)/, /^\/out($|\/)/]
  },
  hooks: {
    packageAfterPrune: async (_forgeConfig, buildPath, _electronVersion, platform, arch) => {
      execSync('npm prune --omit=dev --ignore-scripts', { cwd: buildPath, stdio: 'ignore' })
      removeNonTargetPrebuilds(buildPath, platform, arch)
    }
  },
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    }
  ]
}
