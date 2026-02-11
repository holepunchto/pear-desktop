import { useEffect, useState } from 'react'

export default function App() {
  const [config, setConfig] = useState({ version: '...', key: '' })
  const [status, setStatus] = useState('')

  useEffect(() => {
    window.bridge.getConfig().then((nextConfig) => {
      setConfig(nextConfig || { version: '...', key: '' })
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
        VERSION {String(config.version)}
        {status ? `: ${status}` : ''}
      </h1>
      <p>KEY {String(config.key || '')}</p>
      <h2>It's even yet mucher improveder</h2>
      <h2>TWICE</h2>
    </>
  )
}
