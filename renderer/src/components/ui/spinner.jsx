import Loader2Icon from 'lucide-react/dist/esm/icons/loader-2.mjs'

import { cn } from '@/lib/utils'

function Spinner({ className, ...props }) {
  return (
    <Loader2Icon
      role='status'
      aria-label='Loading'
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
