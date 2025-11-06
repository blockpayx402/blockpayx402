import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AppProvider } from './context/AppContext'
import Dashboard from './pages/Dashboard'
import PaymentRequest from './pages/PaymentRequest'
import Transactions from './pages/Transactions'
import PaymentPage from './pages/PaymentPage'
import Staking from './pages/Staking'
import OrderStatus from './pages/OrderStatus'
import Swapper from './pages/Swapper'
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
            <Route path="/pay/:requestId" element={<PaymentPage />} />
            <Route path="/status/:orderId" element={<OrderStatus />} />
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

