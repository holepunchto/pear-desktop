import { useEffect, useState } from 'react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

export const State = {
  idle: 'IDLE',
  updating: 'UPDATING',
  updated: 'UPDATED'
}

const copy = {
  [State.updating]: {
    title: 'Update discovered',
    description: 'Applying in the background…'
  },
  [State.updated]: {
    title: 'Update available',
    description: 'Restart to upgrade'
  }
}

export default function UpdateNotice() {
  const [status, setStatus] = useState(State.idle)

  useEffect(() => {
    return window.bridge.onRuntimeEvent((eventName) => {
      if (eventName === 'updating') setStatus('Updating...')
      if (eventName === 'updated') {
        window.bridge.applyUpdate()
        setStatus('Updated! Restart for latest')
      }
    })
  }, [])

  if (status === State.idle) return null

  const labels = copy[status]
  let action
  switch (status) {
    case State.updating: {
      action = (
        <Badge variant='secondary'>
          <Spinner data-icon='inline-start' />
          Updating
        </Badge>
      )
      break
    }
    case State.updated: {
      action = (
        <Button size='xs' variant='default'>
          Restart
        </Button>
      )
      break
    }
    default:
      break
  }

  return (
    <div className='fixed right-5 bottom-5'>
      <Alert className='max-w-md min-w-72'>
        <AlertTitle>{labels.title}</AlertTitle>
        <AlertDescription className='flex flex-col gap-2'>
          <div>{labels.description}</div>
          <div>{action}</div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
