import { useEffect, useState } from 'react'
import pearSvg from './assets/pear-vector.svg'
import UpdateNotice from '@/components/update-notice.jsx'
import { ThemeProvider } from '@/components/theme-provider.jsx'
import { Badge } from '@/components/ui/badge'

const WORKER_SPECIFIER = '/worker/main.js'
const EMPTY_ARRAY = Object.freeze([])
const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' })

const WELCOME_PANEL = (
  <div className='prose max-w-prose'>
    <p className='mb-6'>
      <img src={pearSvg} className='h-16' alt='Pear' />
    </p>
    <h1 className='uppercase'>Welcome to the internet of peers</h1>
    <p>
      Build <strong>unstoppable, zero-infra P2P applications</strong> for all platforms.
    </p>
    <p>
      Pear is the developer tooling + p2p distribution and runtime. Pear apps run on{' '}
      <a
        href='https://docs.pears.com/reference/bare-overview.html'
        target='_blank'
        rel='noreferrer'
      >
        Bare
      </a>
      , a <strong>small and modular JavaScript runtime</strong> for desktop and mobile, optimized
      for cross-device support and small-as-possible footprint.
    </p>
    <p>
      Building on Pear and peer-to-peer, your apps <strong>scale automatically with growth</strong>.
      The more the merrier.
    </p>

    <ul className='mt-4'>
      <li>
        [&nbsp;
        <a
          href='https://docs.pears.com/guide/getting-started.html'
          target='_blank'
          rel='noreferrer'
        >
          Getting Started
        </a>
        &nbsp; ]
      </li>
      <li>
        [&nbsp;
        <a href='https://docs.pears.com' target='_blank' rel='noreferrer'>
          Docs
        </a>
        &nbsp;]
      </li>
      <li>
        [&nbsp;
        <a href='#' target='_blank' rel='noreferrer'>
          Join the community on Keet
        </a>
        &nbsp;]
      </li>
    </ul>
  </div>
)

function formatNode(node) {
  if (!node || !node.host || !node.port) return 'unknown'
  return `${node.host}:${node.port}`
}

function Metric({ label, value }) {
  return (
    <div className='inline-flex text-xs items-center border *:px-2 *:py-1'>
      <div className='bg-muted'>{label}</div>
      <div className='flex-none'>{value}</div>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <section className='space-y-3 border bg-card p-4'>
      <header>
        <h2 className='uppercase'>{title}</h2>
        {subtitle ? <p className='text-muted-foreground'>{subtitle}</p> : null}
      </header>
      {children}
    </section>
  )
}

function SwarmConnectionTable({
  attemptedClients,
  closedClients,
  closedServers,
  connectedClients,
  connectedServers
}) {
  return (
    <div className='overflow-x-auto border'>
      <table className='w-full text-left text-xs'>
        <thead className='bg-muted/70 text-muted-foreground'>
          <tr>
            <th className='px-3 py-2 font-medium'>Channel</th>
            <th className='px-3 py-2 font-medium'>Opened</th>
            <th className='px-3 py-2 font-medium'>Closed</th>
            <th className='px-3 py-2 font-medium'>Attempted</th>
          </tr>
        </thead>
        <tbody>
          <tr className='border-t'>
            <td className='px-3 py-2'>Client</td>
            <td className='px-3 py-2'>{connectedClients}</td>
            <td className='px-3 py-2'>{closedClients}</td>
            <td className='px-3 py-2'>{attemptedClients}</td>
          </tr>
          <tr className='border-t'>
            <td className='px-3 py-2'>Server</td>
            <td className='px-3 py-2'>{connectedServers}</td>
            <td className='px-3 py-2'>{closedServers}</td>
            <td className='px-3 py-2'>n/a</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function NodeList({ emptyText, nodes, title }) {
  return (
    <div className='border'>
      <div className='border-b bg-muted/70 p-2 text-xs'>
        {title} ({nodes.length})
      </div>
      <div className='max-h-48 overflow-auto p-2 text-xs space-y-2'>
        {nodes.length === 0 ? (
          <div className='text-muted-foreground'>{emptyText}</div>
        ) : (
          nodes.map((node, index) => (
            <div key={`${node.host}:${node.port}:${index}`}>{formatNode(node)}</div>
          ))
        )}
      </div>
    </div>
  )
}

function CoreKeyList({ emptyText, keys, title }) {
  return (
    <div className='border'>
      <div className='border-b bg-muted/70 p-2 text-xs'>
        {title} ({keys.length})
      </div>
      <div className='max-h-48 overflow-auto p-2 text-xs space-y-2'>
        {keys.length === 0 ? (
          <div className='text-muted-foreground'>{emptyText}</div>
        ) : (
          keys.map((key) => (
            <div key={key} className='truncate'>
              {key}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function useRuntimeStats(workerSpecifier) {
  const [state, setState] = useState({
    stats: null,
    loading: true,
    error: '',
    lastUpdatedAt: null
  })

  useEffect(() => {
    let active = true
    let buffer = ''
    const decoder = new TextDecoder('utf-8')

    const applyMessage = (message) => {
      if (!active || !message || typeof message !== 'object') return

      if (message.type === 'runtime:stats' && message.stats) {
        setState({
          stats: message.stats,
          loading: false,
          error: '',
          lastUpdatedAt: Date.now()
        })
        return
      }

      if (message.type === 'runtime:stats:error') {
        setState((current) => ({
          ...current,
          loading: false,
          error: message.error || 'Failed to fetch stats'
        }))
      }
    }

    const parseChunk = (data) => {
      buffer += decoder.decode(data, { stream: true })
      let boundary = buffer.indexOf('\n')

      while (boundary !== -1) {
        const line = buffer.slice(0, boundary).trim()
        buffer = buffer.slice(boundary + 1)
        boundary = buffer.indexOf('\n')
        if (!line) continue

        try {
          applyMessage(JSON.parse(line))
        } catch {}
      }
    }

    const offWorkerIPC = window.bridge.onWorkerIPC(workerSpecifier, parseChunk)
    const offWorkerExit = window.bridge.onWorkerExit(workerSpecifier, () => {
      if (!active) return
      setState((current) => ({ ...current, loading: false, error: 'Stats worker exited' }))
    })

    window.bridge.startWorker(workerSpecifier).catch((err) => {
      if (!active) return
      setState((current) => ({
        ...current,
        loading: false,
        error: err?.message || 'Failed to start stats worker'
      }))
    })

    return () => {
      active = false
      offWorkerIPC()
      offWorkerExit()
    }
  }, [workerSpecifier])

  return state
}

function RuntimeStatsDashboard() {
  const { stats, loading, error, lastUpdatedAt } = useRuntimeStats(WORKER_SPECIFIER)

  const dht = stats?.dht
  const corestore = stats?.corestore
  const swarm = stats?.swarm
  const swarmStats = swarm?.stats
  const clientConnects = swarmStats?.connects?.client
  const serverConnects = swarmStats?.connects?.server

  const knownNodes = dht?.knownNodes ?? EMPTY_ARRAY
  const bootstrapNodes = dht?.bootstrap ?? EMPTY_ARRAY
  const loadedCoreKeys = corestore?.loadedCoreDiscoveryKeys ?? EMPTY_ARRAY
  const persistedCoreKeys = corestore?.persistedCoreDiscoveryKeys ?? EMPTY_ARRAY

  const connectedClients = clientConnects?.opened ?? 0
  const closedClients = clientConnects?.closed ?? 0
  const attemptedClients = clientConnects?.attempted ?? 0
  const connectedServers = serverConnects?.opened ?? 0
  const closedServers = serverConnects?.closed ?? 0

  let headerStatus = 'Connected'
  if (loading) headerStatus = 'Loading runtime stats...'
  else if (error) headerStatus = error
  else if (lastUpdatedAt) headerStatus = `Last update ${TIME_FORMATTER.format(lastUpdatedAt)}`

  return (
    <div className='min-h-lvh'>
      <header className='h-8 flex items-center justify-end px-1.5 pt-px'>
        <Badge className='gap-2' variant='secondary'>
          <span>{headerStatus}</span>
          <span className='size-2 bg-yellow-300 animate-pulse rounded-full' />
        </Badge>
      </header>

      <div className='grid grid-cols-[1fr_minmax(200px,50%)] [--space:--spacing(3)] p-(--space) gap-(--space) md:[--space:--spacing(8)]'>
        <div>{WELCOME_PANEL}</div>

        <div className='grid grid-cols-1 gap-(--space)'>
          <Section title='Swarm' subtitle='Hyperswarm connections'>
            <div className='flex gap-2'>
              <Metric label='Connecting' value={swarm?.connecting ?? 0} />
              <Metric label='Banned Peers' value={swarmStats?.bannedPeers ?? 0} />
            </div>
            <SwarmConnectionTable
              attemptedClients={attemptedClients}
              closedClients={closedClients}
              closedServers={closedServers}
              connectedClients={connectedClients}
              connectedServers={connectedServers}
            />
          </Section>

          <Section title='DHT' subtitle='Bootstrap + routed known nodes'>
            <div className='grid gap-4 lg:grid-cols-2'>
              <NodeList emptyText='No bootstrap nodes' nodes={bootstrapNodes} title='Bootstrap' />
              <NodeList emptyText='No known nodes' nodes={knownNodes} title='Known Nodes' />
            </div>
          </Section>

          <Section title='Corestore' subtitle='Loaded and persisted core keys'>
            <div className='flex gap-2'>
              <Metric label='Loaded Cores' value={corestore?.loadedCores ?? 'n/a'} />
              <Metric label='Persisted Cores' value={corestore?.persistedCores ?? 'n/a'} />
            </div>
            <div className='grid gap-4 lg:grid-cols-2'>
              <CoreKeyList
                emptyText='No loaded core keys'
                keys={loadedCoreKeys}
                title='Loaded Keys'
              />
              <CoreKeyList
                emptyText='No persisted core keys'
                keys={persistedCoreKeys}
                title='Persisted Keys'
              />
            </div>
            {corestore?.persistedError ? (
              <p className='mt-3 text-xs text-destructive'>{corestore.persistedError}</p>
            ) : null}
          </Section>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <RuntimeStatsDashboard />
      <UpdateNotice />
    </ThemeProvider>
  )
}
