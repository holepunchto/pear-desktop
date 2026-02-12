import pearsSvg from './assets/pears.svg'
import UpdateNotice from '@/components/update-notice.jsx'
import { ThemeProvider } from '@/components/theme-provider.jsx'

export default function App() {
  return (
    <ThemeProvider>
      <div className='flex flex-col items-center justify-center min-h-lvh'>
        <img src={pearsSvg} alt='Pears' />
      </div>
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
