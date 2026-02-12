import { useEffect, useState } from 'react'

export const State = {
  idle: 'IDLE',
  updating: 'UPDATING',
  updated: 'UPDATED'
}

export default function UpdateNotice() {
  const [status, setStatus] = useState(State.updating)

  // useEffect(() => {
  //   return window.bridge.onRuntimeEvent((eventName) => {
  //     if (eventName === 'updating') setStatus('Updating...')
  //     if (eventName === 'updated') {
  //       window.bridge.applyUpdate()
  //       setStatus('Updated! Restart for latest')
  //     }
  //   })
  // }, [])

  if (status === State.idle) return null

  return (
    <div className='bg-bg border absolute right-5 bottom-5 rounded px-5 py-3'>
      {status === State.updating && <></>}
      {status === State.updated && <></>}
    </div>
  )
}
