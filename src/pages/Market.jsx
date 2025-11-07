import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Search, Loader2, DollarSign, BarChart3 } from 'lucide-react'

const Market = () => {
  const [coins, setCoins] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchMarketData()
    // Refresh every 60 seconds
    const interval = setInterval(fetchMarketData, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchMarketData = async () => {
    try {
      setLoading(true)
      setError(null)
      // CoinGecko API - free, no API key needed
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h'
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch market data')
      }
      
      const data = await response.json()
      setCoins(data)
    } catch (err) {
      console.error('Error fetching market data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredCoins = coins.filter(coin =>
    coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatPrice = (price) => {
    if (price < 0.01) return `$${price.toFixed(6)}`
    if (price < 1) return `$${price.toFixed(4)}`
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  }

  const formatMarketCap = (cap) => {
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`
    return `$${cap.toLocaleString()}`
  }

  if (loading && coins.length === 0) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-white/60" />
          </div>
          <p className="text-white/60 text-lg tracking-tight">Loading market data...</p>
        </div>
      </div>
    )
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
          <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">Crypto Market</h1>
          <p className="text-white/60 text-lg tracking-tight">Real-time cryptocurrency prices and market data</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMarketData}
            disabled={loading}
            className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-4 border border-white/[0.08]"
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cryptocurrencies..."
            className="w-full pl-12 pr-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 focus:outline-none transition-all bg-white/[0.04] text-white placeholder:text-white/30"
          />
        </div>
      </motion.div>

      {/* Error State */}
      {error && (
        <div className="glass rounded-2xl p-6 border border-red-500/30 text-center">
          <p className="text-red-400 mb-2">Error loading market data</p>
          <p className="text-white/60 text-sm">{error}</p>
          <button
            onClick={fetchMarketData}
            className="mt-4 px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Market Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-3xl border border-white/[0.08] overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/[0.08]">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-medium text-white/60 tracking-tight">#</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-white/60 tracking-tight">Coin</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-white/60 tracking-tight">Price</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-white/60 tracking-tight">24h Change</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-white/60 tracking-tight">Market Cap</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-white/60 tracking-tight">Volume</th>
              </tr>
            </thead>
            <tbody>
              {filteredCoins.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-white/60">
                    No cryptocurrencies found
                  </td>
                </tr>
              ) : (
                filteredCoins.map((coin, index) => {
                  const change24h = coin.price_change_percentage_24h || 0
                  const isPositive = change24h >= 0
                  
                  return (
                    <motion.tr
                      key={coin.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-4 px-6 text-white/60 text-sm">{coin.market_cap_rank || index + 1}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <img
                            src={coin.image}
                            alt={coin.name}
                            className="w-8 h-8 rounded-full"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                          <div>
                            <div className="font-medium text-white tracking-tight">{coin.name}</div>
                            <div className="text-sm text-white/50 tracking-tight uppercase">{coin.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="font-medium text-white tracking-tight">{formatPrice(coin.current_price)}</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className={`flex items-center justify-end gap-1 ${
                          isPositive ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {isPositive ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span className="font-medium tracking-tight">
                            {Math.abs(change24h).toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-white/80 tracking-tight">{formatMarketCap(coin.market_cap)}</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-white/60 text-sm tracking-tight">
                          {formatMarketCap(coin.total_volume)}
                        </div>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Info Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center text-white/40 text-xs tracking-tight"
      >
        <p>Data provided by CoinGecko API • Updates every 60 seconds</p>
      </motion.div>
    </div>
  )
}

export default Market

