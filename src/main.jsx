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
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
