/** @typedef {import('pear-interface')} */
import Runtime from 'pear-electron'
import Bridge from 'pear-bridge'

const bridge = new Bridge({
  waypoint: 'index.html',
  bypass: ['/node_modules', '/vendor/chromium/devtools-frontend/out/Default/gen/front_end/']
})
await bridge.ready()

const runtime = new Runtime()
const pipe = await runtime.start({
  bridge
})

pipe.on('close', () => Pear.exit())
