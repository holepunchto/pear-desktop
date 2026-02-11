import { useEffect, useState } from 'react'

export default function App() {
  const [text, setText] = useState('VERSION 1')

  useEffect(() => {
    const off = window.bridge.onRuntimeEvent((eventName) => {
      if (eventName === 'updating') setText('VERSION 1: Updating...')
      if (eventName === 'updated') {
        window.bridge.applyUpdate()

        setText('VERSION 1: Updated! Restart for latest')
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
      <img src='assets/pears.svg' alt='Pears' />
      <h1>{text}</h1>
    </>
  )
}
