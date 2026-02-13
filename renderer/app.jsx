import { useEffect, useMemo, useState } from 'react'
import pearsSvg from './assets/pears.svg'
import UpdateNotice from '@/components/update-notice.jsx'
import { ThemeProvider } from '@/components/theme-provider.jsx'
import { Badge } from '@/components/ui/badge'

const POLL_INTERVAL_MS = 2000

function formatNode(node) {
  if (!node || !node.host || !node.port) return 'unknown'
  return `${node.host}:${node.port}`
}

function Metric({ label, value }) {
  return (
    <div className='rounded-lg border border-border bg-card/80 px-3 py-2'>
      <div className='text-[11px] uppercase tracking-wide text-muted-foreground'>{label}</div>
      <div className='mt-1 text-base font-semibold'>{value}</div>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <section className='rounded-2xl border border-border bg-card/85 p-4 shadow-sm'>
      <div className='mb-3'>
        <h2 className='text-sm font-semibold'>{title}</h2>
        {subtitle ? <p className='text-xs text-muted-foreground'>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function RuntimeStatsDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const fetchStats = async () => {
      try {
        const nextStats = await window.bridge.getStats()
        if (!mounted) return
        setStats(nextStats)
        setLoading(false)
        setError('')
      } catch (err) {
        if (!mounted) return
        setLoading(false)
        setError(err?.message || 'Failed to fetch stats')
      }
    }
    fetchStats()
    const timer = setInterval(fetchStats, POLL_INTERVAL_MS)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const knownNodes = stats?.dht?.knownNodes || []
  const bootstrapNodes = stats?.dht?.bootstrap || []
  const loadedCoreKeys = stats?.corestore?.loadedCoreDiscoveryKeys || []
  const persistedCoreKeys = stats?.corestore?.persistedCoreDiscoveryKeys || []

  const connectedClients = stats?.swarm?.stats?.connects?.client?.opened ?? 0
  const closedClients = stats?.swarm?.stats?.connects?.client?.closed ?? 0
  const attemptedClients = stats?.swarm?.stats?.connects?.client?.attempted ?? 0
  const connectedServers = stats?.swarm?.stats?.connects?.server?.opened ?? 0
  const closedServers = stats?.swarm?.stats?.connects?.server?.closed ?? 0

  const headerStatus = useMemo(() => {
    if (loading) return 'Loading runtime stats...'
    if (error) return error
    return `Polling every ${POLL_INTERVAL_MS / 1000}s`
  }, [loading, error])

  return (
    <div className='min-h-lvh'>
      <header className='h-8 flex items-center justify-end px-1.5'>
        <Badge className='gap-2' variant='secondary'>
          <span>Refreshing every 2s</span>
          <span className='size-2 bg-yellow-300 animate-pulse rounded-full' />
        </Badge>
      </header>

      <div className='mx-auto max-w-7xl space-y-5'>
        <header className='mb-10'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='flex items-center gap-3'>
              <img className='h-10' src={pearsSvg} alt='Pear' />
              <div>
                <h1 className='text-lg font-semibold leading-tight'>Runtime</h1>
                <p className='text-xs text-muted-foreground'>{headerStatus}</p>
              </div>
            </div>
          </div>
        </header>

        <section className='grid grid-cols-2 gap-3 md:grid-cols-4'>
          <Metric label='Swarm Connections' value={stats?.swarm?.connections ?? 0} />
          <Metric label='Known Peers' value={stats?.swarm?.peers ?? 0} />
          <Metric label='Known DHT Nodes' value={knownNodes.length} />
          <Metric label='Loaded Cores' value={stats?.corestore?.loadedCores ?? 'n/a'} />
        </section>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Section title='Swarm' subtitle='Live hyperswarm counters'>
            <div className='grid grid-cols-2 gap-3'>
              <Metric label='Connecting' value={stats?.swarm?.connecting ?? 0} />
              <Metric label='Banned Peers' value={stats?.swarm?.stats?.bannedPeers ?? 0} />
            </div>
            <div className='mt-3 overflow-x-auto rounded-lg border border-border'>
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
                  <tr className='border-t border-border'>
                    <td className='px-3 py-2'>Client</td>
                    <td className='px-3 py-2'>{connectedClients}</td>
                    <td className='px-3 py-2'>{closedClients}</td>
                    <td className='px-3 py-2'>{attemptedClients}</td>
                  </tr>
                  <tr className='border-t border-border'>
                    <td className='px-3 py-2'>Server</td>
                    <td className='px-3 py-2'>{connectedServers}</td>
                    <td className='px-3 py-2'>{closedServers}</td>
                    <td className='px-3 py-2'>n/a</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title='DHT' subtitle='Bootstrap + routed known nodes'>
            <div className='grid gap-3 md:grid-cols-2'>
              <div className='rounded-lg border border-border'>
                <div className='border-b border-border bg-muted/70 px-3 py-2 text-xs font-medium'>
                  Bootstrap ({bootstrapNodes.length})
                </div>
                <div className='max-h-48 overflow-auto p-2 text-xs'>
                  {bootstrapNodes.length === 0 ? (
                    <div className='text-muted-foreground'>No bootstrap nodes</div>
                  ) : (
                    bootstrapNodes.map((node, index) => (
                      <div
                        key={`${node.host}:${node.port}:${index}`}
                        className='px-1 py-1 font-mono'
                      >
                        {formatNode(node)}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className='rounded-lg border border-border'>
                <div className='border-b border-border bg-muted/70 px-3 py-2 text-xs font-medium'>
                  Known Nodes ({knownNodes.length})
                </div>
                <div className='max-h-48 overflow-auto p-2 text-xs'>
                  {knownNodes.length === 0 ? (
                    <div className='text-muted-foreground'>No known nodes</div>
                  ) : (
                    knownNodes.map((node, index) => (
                      <div
                        key={`${node.host}:${node.port}:${index}`}
                        className='px-1 py-1 font-mono'
                      >
                        {formatNode(node)}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Section title='Corestore' subtitle='Loaded and persisted core keys'>
            <div className='grid grid-cols-2 gap-3'>
              <Metric label='Loaded Cores' value={stats?.corestore?.loadedCores ?? 'n/a'} />
              <Metric label='Persisted Cores' value={stats?.corestore?.persistedCores ?? 'n/a'} />
            </div>
            <div className='mt-3 grid gap-3 md:grid-cols-2'>
              <div className='rounded-lg border border-border'>
                <div className='border-b border-border bg-muted/70 px-3 py-2 text-xs font-medium'>
                  Loaded Keys ({loadedCoreKeys.length})
                </div>
                <div className='max-h-48 overflow-auto p-2 text-xs'>
                  {loadedCoreKeys.length === 0 ? (
                    <div className='text-muted-foreground'>No loaded core keys</div>
                  ) : (
                    loadedCoreKeys.map((key) => (
                      <div key={key} className='truncate px-1 py-1 font-mono'>
                        {key}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className='rounded-lg border border-border'>
                <div className='border-b border-border bg-muted/70 px-3 py-2 text-xs font-medium'>
                  Persisted Keys ({persistedCoreKeys.length})
                </div>
                <div className='max-h-48 overflow-auto p-2 text-xs'>
                  {persistedCoreKeys.length === 0 ? (
                    <div className='text-muted-foreground'>No persisted core keys</div>
                  ) : (
                    persistedCoreKeys.map((key) => (
                      <div key={key} className='truncate px-1 py-1 font-mono'>
                        {key}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            {stats?.corestore?.persistedError ? (
              <p className='mt-3 text-xs text-destructive'>{stats.corestore.persistedError}</p>
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

// const [config, setConfig] = useState({ version: '...', key: '' })
//
// useEffect(() => {
//   window.bridge.getConfig().then((nextConfig) => {
//     setConfig(nextConfig || { version: '...', key: '' })
//   })
//
//   const offWorkerData = window.bridge.onWorkerData((data) => {
//     console.log('worker:', data)
//   })
//
//   window.bridge.startWorker()
//
//   return () => {
//     offWorkerData()
//   }
// }, [])
//
