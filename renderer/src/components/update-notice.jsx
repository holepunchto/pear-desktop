import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

export const State = {
  idle: 'IDLE',
  updating: 'UPDATING',
  updated: 'UPDATED'
}

const COPY = {
  [State.updating]: {
    title: 'Update discovered',
    description: 'Applying in the background…'
  },
  [State.updated]: {
    title: 'Update available',
    description: 'Restart to upgrade'
  }
}

function UpdateAction({ onRestart, status }) {
  if (status === State.updating) {
    return (
      <Badge variant='secondary'>
        <Spinner data-icon='inline-start' />
        Updating
      </Badge>
    )
  }

  if (status === State.updated) {
    return (
      <Button size='xs' variant='default' onClick={onRestart}>
        Restart
      </Button>
    )
  }

  return null
}

export default function UpdateNotice() {
  const [status, setStatus] = useState(State.idle)

  useEffect(() => {
    const offUpdating = window.bridge.onPearEvent('updating', () => {
      setStatus(State.updating)
    })
    const offUpdated = window.bridge.onPearEvent('updated', () => {
      setStatus(State.updated)
    })

    return () => {
      offUpdating()
      offUpdated()
    }
  }, [])

  if (status === State.idle) return null

  const labels = COPY[status]

  return (
    <div className='fixed right-5 bottom-5'>
      <Alert className='max-w-md min-w-72'>
        <AlertTitle>{labels.title}</AlertTitle>
        <AlertDescription className='flex flex-col gap-2'>
          <div>{labels.description}</div>
          <div>
            <UpdateAction
              status={status}
              onRestart={() =>
                window.bridge.applyUpdate().then(() => window.bridge.appAfterUpdate())
              }
            />
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
