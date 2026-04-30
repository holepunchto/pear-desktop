import test from 'brittle'
import { parseLaunchArgs } from '../electron/launch-args.js'

test('parseLaunchArgs defaults to updates on', (t) => {
  t.alike(parseLaunchArgs(['/Electron', '.']), {
    storage: undefined,
    updates: true
  })
})

test('parseLaunchArgs reads development app flags', (t) => {
  t.alike(parseLaunchArgs(['/Electron', '.', '--no-updates', '--storage', '/tmp/pear']), {
    storage: '/tmp/pear',
    updates: false
  })
})

test('parseLaunchArgs ignores Electron and Chromium flags', (t) => {
  t.alike(
    parseLaunchArgs([
      '/Electron',
      '--remote-debugging-port=9222',
      '.',
      '--no-updates',
      '--enable-logging',
      '--storage=/tmp/pear'
    ]),
    {
      storage: '/tmp/pear',
      updates: false
    }
  )
})

test('parseLaunchArgs reads packaged app flags after executable', (t) => {
  t.alike(
    parseLaunchArgs(
      ['/Applications/Pear Desktop.app/Contents/MacOS/Pear Desktop', '--storage=/tmp/app'],
      {
        isPackaged: true
      }
    ),
    {
      storage: '/tmp/app',
      updates: true
    }
  )
})
