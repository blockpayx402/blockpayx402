import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Zap, TrendingUp, TrendingDown, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'

const GasTracker = () => {
  const [gasData, setGasData] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedChain, setSelectedChain] = useState('ethereum')

  const chains = [
    { id: 'ethereum', name: 'Ethereum', rpc: 'https://eth.llamarpc.com' },
    { id: 'polygon', name: 'Polygon', rpc: 'https://polygon.llamarpc.com' },
    { id: 'binance', name: 'BNB Chain', rpc: 'https://bsc.llamarpc.com' },
    { id: 'arbitrum', name: 'Arbitrum', rpc: 'https://arb1.arbitrum.io/rpc' },
    { id: 'optimism', name: 'Optimism', rpc: 'https://mainnet.optimism.io' },
  ]

  useEffect(() => {
    fetchGasPrices()
    // Refresh every 30 seconds
    const interval = setInterval(fetchGasPrices, 30000)
    return () => clearInterval(interval)
  }, [selectedChain])

  const fetchGasPrices = async () => {
    setLoading(true)
    try {
      const chain = chains.find(c => c.id === selectedChain)
      if (!chain) return

      // Fetch gas prices from blockchain RPC
      const gasData = await fetchChainGasPrice(chain)
      setGasData(gasData)
    } catch (error) {
      console.error('Error fetching gas prices:', error)
      toast.error('Failed to fetch gas prices')
    } finally {
      setLoading(false)
    }
  }

  const fetchChainGasPrice = async (chain) => {
    try {
      // For Ethereum, use eth_gasPrice
      if (chain.id === 'ethereum') {
        const response = await fetch(chain.rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_gasPrice',
            params: [],
          }),
        })
        const data = await response.json()
        const gasPriceWei = parseInt(data.result, 16)
        const gasPriceGwei = gasPriceWei / 1e9

        // Estimate different transaction types
        return {
          chain: chain.name,
          slow: gasPriceGwei * 0.8,
          standard: gasPriceGwei,
          fast: gasPriceGwei * 1.2,
          instant: gasPriceGwei * 1.5,
          timestamp: Date.now(),
        }
      }

      // For other chains, use similar approach
      const response = await fetch(chain.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_gasPrice',
          params: [],
        }),
      })
      const data = await response.json()
      const gasPriceWei = parseInt(data.result, 16)
      const gasPriceGwei = gasPriceWei / 1e9

      return {
        chain: chain.name,
        slow: gasPriceGwei * 0.8,
        standard: gasPriceGwei,
        fast: gasPriceGwei * 1.2,
        instant: gasPriceGwei * 1.5,
        timestamp: Date.now(),
      }
    } catch (error) {
      console.error(`Error fetching gas for ${chain.name}:`, error)
      // Return mock data if RPC fails
      return {
        chain: chain.name,
        slow: 20,
        standard: 25,
        fast: 30,
        instant: 40,
        timestamp: Date.now(),
      }
    }
  }

  const getGasStatus = (gasPrice) => {
    if (gasPrice < 20) return { label: 'Low', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' }
    if (gasPrice < 50) return { label: 'Normal', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' }
    if (gasPrice < 100) return { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' }
    return { label: 'Very High', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' }
  }

  const calculateCost = (gasPrice, gasLimit = 21000) => {
    // For simple transfer (21000 gas)
    const costInGwei = gasPrice * gasLimit
    const costInEth = costInGwei / 1e9
    return costInEth
  }

  const gasTiers = [
    { name: 'Slow', key: 'slow', time: '~5 min', gasLimit: 21000 },
    { name: 'Standard', key: 'standard', time: '~2 min', gasLimit: 21000 },
    { name: 'Fast', key: 'fast', time: '~30 sec', gasLimit: 21000 },
    { name: 'Instant', key: 'instant', time: '~15 sec', gasLimit: 21000 },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">Gas Price Tracker</h1>
          <p className="text-white/60 text-lg tracking-tight">Monitor gas prices across multiple blockchains</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value)}
            className="px-4 py-2 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 focus:outline-none transition-all bg-white/[0.04] text-white"
          >
            {chains.map(chain => (
              <option key={chain.id} value={chain.id} className="bg-black text-white">
                {chain.name}
              </option>
            ))}
          </select>
          <button
            onClick={fetchGasPrices}
            disabled={loading}
            className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {loading && !gasData.chain ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-white/60 mx-auto mb-4" />
            <p className="text-white/60 tracking-tight">Loading gas prices...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Current Gas Price */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-3xl p-8 border border-white/[0.08]"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-white/60 text-sm mb-2 tracking-tight">Current Gas Price</p>
                <h2 className="text-4xl font-bold mb-2 tracking-tight">
                  {gasData.standard?.toFixed(2) || '0.00'} Gwei
                </h2>
                <p className="text-white/40 text-sm tracking-tight">{gasData.chain || selectedChain}</p>
              </div>
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/20 to-primary-600/20 border border-primary-500/30 flex items-center justify-center">
                <Zap className="w-10 h-10 text-primary-400" />
              </div>
            </div>
            {gasData.standard && (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${getGasStatus(gasData.standard).bg} ${getGasStatus(gasData.standard).border}`}>
                <AlertCircle className={`w-4 h-4 ${getGasStatus(gasData.standard).color}`} />
                <span className={`text-sm font-medium ${getGasStatus(gasData.standard).color} tracking-tight`}>
                  {getGasStatus(gasData.standard).label}
                </span>
              </div>
            )}
          </motion.div>

          {/* Gas Tiers */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {gasTiers.map((tier, index) => {
              const gasPrice = gasData[tier.key]
              const status = gasPrice ? getGasStatus(gasPrice) : null
              const cost = gasPrice ? calculateCost(gasPrice, tier.gasLimit) : 0

              return (
                <motion.div
                  key={tier.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="glass rounded-2xl p-6 border border-white/[0.08]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold tracking-tight">{tier.name}</h3>
                    <span className="text-xs text-white/40 tracking-tight">{tier.time}</span>
                  </div>
                  <div className="mb-4">
                    <p className="text-3xl font-bold mb-1 tracking-tight">
                      {gasPrice ? gasPrice.toFixed(2) : '0.00'} Gwei
                    </p>
                    <p className="text-sm text-white/60 tracking-tight">
                      ~{cost.toFixed(6)} {chains.find(c => c.id === selectedChain)?.name === 'Ethereum' ? 'ETH' : 'tokens'}
                    </p>
                  </div>
                  {status && (
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${status.bg} ${status.border} border`}>
                      <span className={status.color}>{status.label}</span>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* Gas Price Chart Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-2xl p-6 border border-white/[0.08]"
          >
            <h3 className="text-lg font-semibold mb-4 tracking-tight">Gas Price Recommendations</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 glass-strong rounded-xl border border-white/10">
                <div>
                  <p className="font-medium text-white tracking-tight">Simple Transfer</p>
                  <p className="text-sm text-white/60 tracking-tight">21,000 gas limit</p>
                </div>
                <p className="text-white/80 tracking-tight">
                  {gasData.standard ? `~${calculateCost(gasData.standard, 21000).toFixed(6)} tokens` : 'N/A'}
                </p>
              </div>
              <div className="flex items-center justify-between p-3 glass-strong rounded-xl border border-white/10">
                <div>
                  <p className="font-medium text-white tracking-tight">Token Swap</p>
                  <p className="text-sm text-white/60 tracking-tight">~150,000 gas limit</p>
                </div>
                <p className="text-white/80 tracking-tight">
                  {gasData.standard ? `~${calculateCost(gasData.standard, 150000).toFixed(6)} tokens` : 'N/A'}
                </p>
              </div>
              <div className="flex items-center justify-between p-3 glass-strong rounded-xl border border-white/10">
                <div>
                  <p className="font-medium text-white tracking-tight">Complex Contract</p>
                  <p className="text-sm text-white/60 tracking-tight">~300,000 gas limit</p>
                </div>
                <p className="text-white/80 tracking-tight">
                  {gasData.standard ? `~${calculateCost(gasData.standard, 300000).toFixed(6)} tokens` : 'N/A'}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}

export default GasTracker

