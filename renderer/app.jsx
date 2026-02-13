import { useEffect, useMemo, useState } from 'react'
import pearSvg from './assets/pear.svg'
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
    <div className='inline-flex text-xs items-center border *:px-2 *:py-1'>
      <div className='bg-muted'>{label}</div>
      <div className='flex-none'>{value}</div>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <section className='space-y-3 border  bg-card p-4'>
      <header>
        <h2 className='uppercase'>{title}</h2>
        {subtitle ? <p className='text-muted-foreground'>{subtitle}</p> : null}
      </header>
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
    return `Refreshing every ${POLL_INTERVAL_MS / 1000}s`
  }, [loading, error])

  return (
    <div className='min-h-lvh'>
      <header className='h-8 flex items-center justify-end px-1.5 mt-px'>
        <Badge className='gap-2' variant='secondary'>
          <span>{headerStatus}</span>
          <span className='size-2 bg-yellow-300 animate-pulse rounded-full' />
        </Badge>
      </header>

      <div className='grid grid-cols-[1fr_minmax(200px,50%)] [--space:--spacing(3)] p-(--space) gap-(--space) md:[--space:--spacing(8)]'>
        <div>
          <div className='prose'>
            <p className='mb-6'>
              <img src={pearSvg} />
            </p>
            <h1 className='uppercase'>Welcome to the internet of peers</h1>
            <p>
              Build <strong>unstoppable, zero-infra P2P applications</strong> for all platforms.
            </p>
            <p>
              Pear is the developer tooling + p2p distribution and runtime. Pear apps run on{' '}
              <a href='https://docs.pears.com/reference/bare-overview.html' target='_blank'>
                Bare
              </a>
              , a <strong>small and modular JavaScript runtime</strong> for desktop and mobile,
              optimized for cross-device support and small-as-possible footprint.
            </p>
            <p>
              Building on Pear and peer-to-peer, your apps{' '}
              <strong>scale automatically with growth</strong>. The more the merrier.
            </p>

            <ul className='mt-4'>
              <li>
                [{' '}
                <a href='https://docs.pears.com/guide/getting-started.html' target='_blank'>
                  Getting Started
                </a>{' '}
                ]
              </li>
              <li>
                [ <a href='https://docs.pears.com'>Docs</a> ]
              </li>
              <li>
                [ <a href='#'>Join the community on Keet</a> ]
              </li>
            </ul>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-(--space)'>
          <Section title='Swarm' subtitle='Hyperswarm connections'>
            <div className='flex gap-2'>
              <Metric label='Connecting' value={stats?.swarm?.connecting ?? 0} />
              <Metric label='Banned Peers' value={stats?.swarm?.stats?.bannedPeers ?? 0} />
            </div>
            <div className='overflow-x-auto border '>
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
                  <tr className='border-t '>
                    <td className='px-3 py-2'>Client</td>
                    <td className='px-3 py-2'>{connectedClients}</td>
                    <td className='px-3 py-2'>{closedClients}</td>
                    <td className='px-3 py-2'>{attemptedClients}</td>
                  </tr>
                  <tr className='border-t '>
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
            <div className='grid gap-4 lg:grid-cols-2'>
              <div className='border '>
                <div className='border-b  bg-muted/70 p-2 text-xs'>
                  Bootstrap ({bootstrapNodes.length})
                </div>
                <div className='max-h-48 overflow-auto p-2 text-xs space-y-2'>
                  {bootstrapNodes.length === 0 ? (
                    <div className='text-muted-foreground'>No bootstrap nodes</div>
                  ) : (
                    bootstrapNodes.map((node, index) => (
                      <div key={`${node.host}:${node.port}:${index}`}>{formatNode(node)}</div>
                    ))
                  )}
                </div>
              </div>

              <div className='border '>
                <div className='border-b  bg-muted/70 p-2 text-xs'>
                  Known Nodes ({knownNodes.length})
                </div>
                <div className='max-h-48 overflow-auto p-2 text-xs space-y-2'>
                  {knownNodes.length === 0 ? (
                    <div className='text-muted-foreground'>No known nodes</div>
                  ) : (
                    knownNodes.map((node, index) => (
                      <div key={`${node.host}:${node.port}:${index}`}>{formatNode(node)}</div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section title='Corestore' subtitle='Loaded and persisted core keys'>
            <div className='flex gap-2'>
              <Metric label='Loaded Cores' value={stats?.corestore?.loadedCores ?? 'n/a'} />
              <Metric label='Persisted Cores' value={stats?.corestore?.persistedCores ?? 'n/a'} />
            </div>
            <div className='grid gap-4 lg:grid-cols-2'>
              <div className='border '>
                <div className='border-b  bg-muted/70 p-2 text-xs'>
                  Loaded Keys ({loadedCoreKeys.length})
                </div>
                <div className='max-h-48 overflow-auto p-2 text-xs space-y-2'>
                  {loadedCoreKeys.length === 0 ? (
                    <div className='text-muted-foreground'>No loaded core keys</div>
                  ) : (
                    loadedCoreKeys.map((key) => (
                      <div key={key} className='truncate'>
                        {key}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className='border '>
                <div className='border-b  bg-muted/70 p-2 text-xs'>
                  Persisted Keys ({persistedCoreKeys.length})
                </div>
                <div className='max-h-48 overflow-auto p-2 text-xs space-y-2'>
                  {persistedCoreKeys.length === 0 ? (
                    <div className='text-muted-foreground'>No persisted core keys</div>
                  ) : (
                    persistedCoreKeys.map((key) => (
                      <div key={key} className='truncate'>
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
