/** @typedef {import('pear-interface')} */
import Runtime from 'pear-electron'
import Bridge from 'pear-bridge'

const bridge = new Bridge()
await bridge.ready()
console.log('hello')
const runtime = new Runtime()
const pipe = await runtime.start({ bridge })

Pear.teardown(() => pipe.destroy())
