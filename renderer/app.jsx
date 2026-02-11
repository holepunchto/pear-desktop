import { useEffect, useState } from 'react'

export default function App() {
  const [version, setVersion] = useState('...')
  const [status, setStatus] = useState('')

  useEffect(() => {
    window.bridge.getVersion().then((nextVersion) => {
      setVersion(String(nextVersion))
    })

    const off = window.bridge.onRuntimeEvent((eventName) => {
      if (eventName === 'updating') setStatus('Updating...')
      if (eventName === 'updated') {
        window.bridge.applyUpdate()
        setStatus('Updated! Restart for latest')
      }
    })

    const offWorkerData = window.bridge.onWorkerData((data) => {
      console.log('worker:', data)
    })

    window.bridge.startWorker()

    return () => {
      off()
      offWorkerData()
    }
  }, [])

  return (
    <>
      <img src='/assets/pears.svg' alt='Pears' />
      <h1>
        VERSION {version}
        {status ? `: ${status}` : ''}
      </h1>
      <h2>It's much improved</h2>
    </>
  )
}
