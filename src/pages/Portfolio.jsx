import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wallet, TrendingUp, TrendingDown, Plus, X, Loader2, Copy, Check } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { toast } from 'react-hot-toast'

const Portfolio = () => {
  const { wallet } = useApp()
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalValue, setTotalValue] = useState(0)
  const [totalChange24h, setTotalChange24h] = useState(0)
  const [newWalletAddress, setNewWalletAddress] = useState('')
  const [selectedChain, setSelectedChain] = useState('ethereum')

  const chains = [
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
    { id: 'binance', name: 'BNB Chain', symbol: 'BNB' },
    { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
    { id: 'solana', name: 'Solana', symbol: 'SOL' },
  ]

  useEffect(() => {
    // Load saved wallets from localStorage
    const savedWallets = localStorage.getItem('portfolio_wallets')
    if (savedWallets) {
      setWallets(JSON.parse(savedWallets))
    }
    
    // Add connected wallet if available
    if (wallet?.connected && wallet?.address) {
      const walletExists = wallets.some(w => w.address === wallet.address && w.chain === wallet.chain)
      if (!walletExists) {
        addWallet(wallet.address, wallet.chain || 'ethereum')
      }
    }
  }, [wallet])

  useEffect(() => {
    if (wallets.length > 0) {
      fetchPortfolioData()
    }
  }, [wallets])

  const addWallet = async (address, chain = 'ethereum') => {
    if (!address || address.trim() === '') {
      toast.error('Please enter a wallet address')
      return
    }

    const walletExists = wallets.some(w => w.address.toLowerCase() === address.toLowerCase() && w.chain === chain)
    if (walletExists) {
      toast.error('Wallet already added')
      return
    }

    const newWallet = {
      id: `${address}_${chain}_${Date.now()}`,
      address: address.trim(),
      chain,
      balance: '0',
      usdValue: 0,
      tokens: [],
    }

    const updatedWallets = [...wallets, newWallet]
    setWallets(updatedWallets)
    localStorage.setItem('portfolio_wallets', JSON.stringify(updatedWallets))
    setNewWalletAddress('')
    toast.success('Wallet added')
  }

  const removeWallet = (id) => {
    const updatedWallets = wallets.filter(w => w.id !== id)
    setWallets(updatedWallets)
    localStorage.setItem('portfolio_wallets', JSON.stringify(updatedWallets))
    toast.success('Wallet removed')
  }

  const fetchPortfolioData = async () => {
    setLoading(true)
    try {
      const updatedWallets = await Promise.all(
        wallets.map(async (wallet) => {
          try {
            // Fetch native token balance
            const chainConfig = chains.find(c => c.id === wallet.chain)
            if (!chainConfig) return wallet

            // Get token price from CoinGecko
            const priceResponse = await fetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${getCoinGeckoId(wallet.chain)}&vs_currencies=usd&include_24hr_change=true`
            )
            const priceData = await priceResponse.json()
            const coinId = getCoinGeckoId(wallet.chain)
            const price = priceData[coinId]?.usd || 0
            const change24h = priceData[coinId]?.usd_24h_change || 0

            // For demo, we'll use a mock balance
            // In production, you'd fetch from blockchain RPC
            const mockBalance = Math.random() * 10 // Mock balance
            const usdValue = mockBalance * price

            // Fetch ERC20 tokens (simplified - would need RPC calls in production)
            const tokens = await fetchWalletTokens(wallet.address, wallet.chain)

            return {
              ...wallet,
              balance: mockBalance.toFixed(4),
              usdValue,
              price,
              change24h,
              tokens,
            }
          } catch (error) {
            console.error(`Error fetching data for wallet ${wallet.address}:`, error)
            return wallet
          }
        })
      )

      setWallets(updatedWallets)
      
      // Calculate totals
      const total = updatedWallets.reduce((sum, w) => sum + (w.usdValue || 0), 0)
      const weightedChange = updatedWallets.reduce((sum, w) => {
        if (w.usdValue && w.change24h) {
          return sum + (w.usdValue * w.change24h / 100)
        }
        return sum
      }, 0)
      const avgChange = total > 0 ? (weightedChange / total) * 100 : 0

      setTotalValue(total)
      setTotalChange24h(avgChange)
    } catch (error) {
      console.error('Error fetching portfolio data:', error)
      toast.error('Failed to fetch portfolio data')
    } finally {
      setLoading(false)
    }
  }

  const fetchWalletTokens = async (address, chain) => {
    // Simplified - in production, you'd fetch from blockchain
    // This is a mock implementation
    return []
  }

  const getCoinGeckoId = (chain) => {
    const mapping = {
      ethereum: 'ethereum',
      binance: 'binancecoin',
      polygon: 'matic-network',
      solana: 'solana',
    }
    return mapping[chain] || 'ethereum'
  }

  const copyAddress = (address) => {
    navigator.clipboard.writeText(address)
    toast.success('Address copied!')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">Portfolio Tracker</h1>
          <p className="text-white/60 text-lg tracking-tight">Track your crypto assets across multiple wallets and chains</p>
        </div>
        <button
          onClick={fetchPortfolioData}
          disabled={loading}
          className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </motion.div>

      {/* Total Portfolio Value */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-3xl p-8 border border-white/[0.08]"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm mb-2 tracking-tight">Total Portfolio Value</p>
            <h2 className="text-5xl font-bold mb-2 tracking-tight">
              ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </h2>
            <div className={`flex items-center gap-2 ${totalChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalChange24h >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
              <span className="text-lg font-medium tracking-tight">
                {Math.abs(totalChange24h).toFixed(2)}% (24h)
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Add Wallet */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-2xl p-6 border border-white/[0.08]"
      >
        <h3 className="text-xl font-semibold mb-4 tracking-tight">Add Wallet</h3>
        <div className="flex gap-4">
          <input
            type="text"
            value={newWalletAddress}
            onChange={(e) => setNewWalletAddress(e.target.value)}
            placeholder="Enter wallet address (0x...)"
            className="flex-1 px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 focus:outline-none transition-all bg-white/[0.04] text-white placeholder:text-white/30"
          />
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value)}
            className="px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 focus:outline-none transition-all bg-white/[0.04] text-white"
          >
            {chains.map(chain => (
              <option key={chain.id} value={chain.id} className="bg-black text-white">
                {chain.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => addWallet(newWalletAddress, selectedChain)}
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white font-medium shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </div>
      </motion.div>

      {/* Wallets List */}
      <div className="space-y-4">
        {wallets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl p-12 border border-white/[0.08] text-center"
          >
            <Wallet className="w-16 h-16 mx-auto mb-4 text-white/40" />
            <p className="text-white/60 text-lg mb-2">No wallets added</p>
            <p className="text-white/40 text-sm">Add a wallet address to start tracking your portfolio</p>
          </motion.div>
        ) : (
          wallets.map((wallet, index) => (
            <motion.div
              key={wallet.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-2xl p-6 border border-white/[0.08]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/20 border border-primary-500/30 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white tracking-tight">
                      {chains.find(c => c.id === wallet.chain)?.name || wallet.chain}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <span className="font-mono">
                        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                      </span>
                      <button
                        onClick={() => copyAddress(wallet.address)}
                        className="hover:text-white transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeWallet(wallet.id)}
                  className="p-2 glass-strong rounded-lg border border-white/10 hover:border-red-500/30 transition-all text-white/60 hover:text-red-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-white/60 text-sm mb-1 tracking-tight">Balance</p>
                  <p className="text-white font-medium tracking-tight">
                    {wallet.balance} {chains.find(c => c.id === wallet.chain)?.symbol || ''}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-sm mb-1 tracking-tight">USD Value</p>
                  <p className="text-white font-medium tracking-tight">
                    ${(wallet.usdValue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-sm mb-1 tracking-tight">24h Change</p>
                  <div className={`flex items-center gap-1 ${wallet.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {wallet.change24h >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span className="font-medium tracking-tight">
                      {wallet.change24h ? Math.abs(wallet.change24h).toFixed(2) : '0.00'}%
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}

export default Portfolio

