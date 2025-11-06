import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Polyfill for Node.js globals (only in browser)
if (typeof window !== 'undefined') {
  // Buffer polyfill
  import('buffer').then((bufferModule) => {
    window.Buffer = bufferModule.Buffer || bufferModule.default?.Buffer || bufferModule
  }).catch(() => {
    // Buffer polyfill not critical
  })
  
  // Process polyfill - use main export, not /browser subpath
  import('process').then((processModule) => {
    // The process package exports from the main entry
    const processPolyfill = processModule.default || processModule
    if (processPolyfill && typeof processPolyfill === 'object') {
      window.process = processPolyfill
    }
  }).catch(() => {
    // Process polyfill not critical - create minimal fallback
    if (!window.process) {
      window.process = { env: {}, browser: true }
    }
  })

  // Handle wallet injection gracefully - prevent errors from third-party wallet connectors
  if (window.ethereum && Object.getOwnPropertyDescriptor(window, 'ethereum')) {
    // ethereum already exists, prevent redefinition errors
    try {
      Object.defineProperty(window, 'ethereum', {
        value: window.ethereum,
        writable: true,
        configurable: true
      })
    } catch (e) {
      // Ignore if already defined correctly
      console.warn('Wallet injection warning (can be safely ignored):', e.message)
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
