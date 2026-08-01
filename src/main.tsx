import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('root element not found')
}

// 调试用：把关键生命周期打印到页面，便于定位空白问题
const debug = (msg: string) => {
  console.log('[main]', msg)
  if ((window as unknown as Record<string, unknown>).__debugLog && typeof (window as unknown as Record<string, unknown>).__debugLog === 'function') {
    ((window as unknown as Record<string, unknown>).__debugLog as (msg: string) => void)(msg)
  }
}

debug('main.tsx executing')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

debug('React render() called')
