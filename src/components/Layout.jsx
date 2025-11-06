import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { 
  Wallet, 
  PlusCircle, 
  History, 
  Menu, 
  X,
  Zap,
  TrendingUp
} from 'lucide-react'

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const navItems = [
    { path: '/', icon: Wallet, label: 'Dashboard' },
    { path: '/request', icon: PlusCircle, label: 'Create Request' },
    { path: '/transactions', icon: History, label: 'Transactions' },
    { path: '/staking', icon: TrendingUp, label: 'Staking' },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="hidden lg:flex flex-col w-80 glass-light border-r border-white/[0.06] p-8"
      >
        <Link to="/" className="flex items-center gap-4 mb-16 group">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-soft-lg shadow-primary-500/20 transition-transform duration-300 group-hover:scale-105">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold gradient-text tracking-tight">Block Payment</h1>
            <p className="text-xs text-white/40 mt-0.5 tracking-wide">Non-Custodial</p>
          </div>
        </Link>

        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group ${
                  isActive
                    ? 'bg-white/[0.08] border border-white/[0.12] shadow-soft'
                    : 'hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06]'
                }`}
              >
                <Icon className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`} />
                <span className={`text-[15px] font-medium tracking-tight transition-colors duration-300 ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white/90'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto pt-8 border-t border-white/[0.06]">
          <div className="glass-light rounded-2xl p-5 border border-white/[0.08]">
            <p className="text-xs text-white/40 mb-1.5 tracking-wide uppercase">Secure & Non-Custodial</p>
            <p className="text-sm text-white/90 font-medium tracking-tight">Your keys, your funds</p>
          </div>
        </div>
      </motion.aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-0 bottom-0 w-80 glass-light border-r border-white/[0.06] p-8"
          >
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <Link to="/" className="flex items-center gap-4 mb-16 group" onClick={() => setSidebarOpen(false)}>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-soft-lg shadow-primary-500/20 transition-transform duration-300 group-hover:scale-105">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold gradient-text tracking-tight">Block Payment</h1>
                <p className="text-xs text-white/40 mt-0.5 tracking-wide">Non-Custodial</p>
              </div>
            </Link>
            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group ${
                      isActive
                        ? 'bg-white/[0.08] border border-white/[0.12] shadow-soft'
                        : 'hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06]'
                    }`}
                  >
                    <Icon className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`} />
                    <span className={`text-[15px] font-medium tracking-tight transition-colors duration-300 ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white/90'}`}>
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </nav>
          </motion.aside>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="glass-light border-b border-white/[0.06] px-8 py-5 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-white/60 hover:text-white transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <WalletConnectButton />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-8 lg:p-12">
          {children}
        </main>
      </div>
    </div>
  )
}

const WalletConnectButton = () => {
  const { wallet, connectWallet, disconnectWallet } = useApp()
  const [showWalletMenu, setShowWalletMenu] = useState(false)

  const handleClick = async () => {
    if (wallet?.connected) {
      await disconnectWallet()
    } else {
      setShowWalletMenu(true)
    }
  }
  
  const handleConnect = async (chain) => {
    setShowWalletMenu(false)
    await connectWallet(chain)
  }

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
        onClick={handleClick}
        className={`px-6 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 flex items-center gap-2.5 ${
          wallet?.connected
            ? 'bg-white text-black shadow-soft-lg hover:shadow-soft-lg hover:bg-white/90'
            : 'glass border border-white/[0.12] text-white/90 hover:bg-white/[0.06] hover:border-white/[0.16]'
        }`}
      >
        {wallet?.connected ? (
          <>
            <span className="font-medium tracking-tight">{formatAddress(wallet.address)}</span>
            <span className="w-2 h-2 bg-green-400 rounded-full shadow-sm shadow-green-400/50"></span>
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            <span className="tracking-tight">Connect Wallet</span>
          </>
        )}
      </motion.button>
      
      <AnimatePresence>
        {showWalletMenu && !wallet?.connected && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full right-0 mt-2 glass rounded-xl border border-white/10 p-2 min-w-[200px] z-50"
          >
            <button
              onClick={() => handleConnect('evm')}
              className="w-full px-4 py-2 text-left rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <span>EVM Wallets</span>
              <span className="text-xs text-white/40">(MetaMask)</span>
            </button>
            <button
              onClick={() => handleConnect('solana')}
              className="w-full px-4 py-2 text-left rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2 mt-1"
            >
              <span>Solana Wallets</span>
              <span className="text-xs text-white/40">(Phantom)</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Layout

