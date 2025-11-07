import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AppProvider } from './context/AppContext'
import Dashboard from './pages/Dashboard'
import PaymentRequest from './pages/PaymentRequest'
import Transactions from './pages/Transactions'
import PaymentPage from './pages/PaymentPage'
import Staking from './pages/Staking'
import Swapper from './pages/Swapper'
import Market from './pages/Market'
import GasTracker from './pages/GasTracker'
import X402 from './pages/X402'
import API from './pages/API'
import SolanaCloser from './pages/SolanaCloser'
import Layout from './components/Layout'

function App() {
  return (
    <AppProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/request" element={<PaymentRequest />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/staking" element={<Staking />} />
            <Route path="/swap" element={<Swapper />} />
            <Route path="/market" element={<Market />} />
            <Route path="/gas" element={<GasTracker />} />
            <Route path="/x402" element={<X402 />} />
            <Route path="/api" element={<API />} />
            <Route path="/solana-closer" element={<SolanaCloser />} />
            <Route path="/pay/:requestId" element={<PaymentPage />} />
          </Routes>
        </Layout>
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(15, 23, 42, 0.95)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
            },
          }}
        />
      </Router>
    </AppProvider>
  )
}

export default App

