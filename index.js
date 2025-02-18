/** @typedef {import('pear-interface')} */
import Runtime from 'pear-electron'
import Bridge from 'pear-bridge'

const runtime = new Runtime()

const bridge = new Bridge({ waypoint: '/index.html' })
await bridge.ready()

const pipe = await runtime.start({ bridge })
Pear.teardown(() => pipe.end())
