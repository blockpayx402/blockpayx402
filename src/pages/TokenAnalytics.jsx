import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, TrendingUp, TrendingDown, DollarSign, BarChart3, Users, Activity, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'react-hot-toast'

const TokenAnalytics = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [tokenData, setTokenData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState([])

  useEffect(() => {
    const saved = localStorage.getItem('token_analytics_searches')
    if (saved) {
      setRecentSearches(JSON.parse(saved))
    }
  }, [])

  const searchToken = async (query) => {
    if (!query || query.trim() === '') {
      toast.error('Please enter a token symbol or name')
      return
    }

    setLoading(true)
    try {
      // Search for token on CoinGecko
      const searchResponse = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
      )
      const searchData = await searchResponse.json()
      
      if (!searchData.coins || searchData.coins.length === 0) {
        toast.error('Token not found')
        setLoading(false)
        return
      }

      const token = searchData.coins[0]
      const tokenId = token.id

      // Fetch detailed token data
      const detailResponse = await fetch(
        `https://api.coingecko.com/api/v3/coins/${tokenId}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true&sparkline=true`
      )
      const detailData = await detailResponse.json()

      setTokenData(detailData)
      
      // Save to recent searches
      const newSearch = {
        id: tokenId,
        name: detailData.name,
        symbol: detailData.symbol.toUpperCase(),
        timestamp: Date.now(),
      }
      const updated = [newSearch, ...recentSearches.filter(s => s.id !== tokenId)].slice(0, 5)
      setRecentSearches(updated)
      localStorage.setItem('token_analytics_searches', JSON.stringify(updated))
      
      setSearchQuery('')
    } catch (error) {
      console.error('Error fetching token data:', error)
      toast.error('Failed to fetch token data')
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
    return `$${num?.toFixed(2) || '0.00'}`
  }

  const formatPercentage = (num) => {
    if (!num) return '0.00%'
    const sign = num >= 0 ? '+' : ''
    return `${sign}${num.toFixed(2)}%`
  }

  if (!tokenData) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">Token Analytics</h1>
          <p className="text-white/60 text-lg tracking-tight">Deep dive into token metrics and performance</p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 border border-white/[0.08]"
        >
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchToken(searchQuery)}
                placeholder="Search token (e.g., BTC, ETH, USDT)..."
                className="w-full pl-12 pr-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 focus:outline-none transition-all bg-white/[0.04] text-white placeholder:text-white/30"
              />
            </div>
            <button
              onClick={() => searchToken(searchQuery)}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white font-medium shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              Search
            </button>
          </div>

          {recentSearches.length > 0 && (
            <div>
              <p className="text-white/60 text-sm mb-3 tracking-tight">Recent Searches</p>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search) => (
                  <button
                    key={search.id}
                    onClick={() => searchToken(search.symbol)}
                    className="px-3 py-1.5 glass-strong rounded-lg border border-white/10 hover:border-primary-500/30 transition-all text-sm text-white/60 hover:text-white"
                  >
                    {search.symbol}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-12 border border-white/[0.08] text-center"
        >
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-white/40" />
          <p className="text-white/60 text-lg mb-2">Search for a token to view analytics</p>
          <p className="text-white/40 text-sm">Enter a token symbol or name to get started</p>
        </motion.div>
      </div>
    )
  }

  const marketData = tokenData.market_data || {}
  const priceChange24h = marketData.price_change_percentage_24h || 0
  const priceChange7d = marketData.price_change_percentage_7d || 0
  const priceChange30d = marketData.price_change_percentage_30d || 0

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">Token Analytics</h1>
          <p className="text-white/60 text-lg tracking-tight">{tokenData.name} ({tokenData.symbol.toUpperCase()})</p>
        </div>
        <button
          onClick={() => setTokenData(null)}
          className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all text-sm"
        >
          New Search
        </button>
      </motion.div>

      {/* Token Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-3xl p-8 border border-white/[0.08]"
      >
        <div className="flex items-center gap-6 mb-6">
          <img
            src={tokenData.image?.large}
            alt={tokenData.name}
            className="w-20 h-20 rounded-full"
          />
          <div className="flex-1">
            <h2 className="text-3xl font-bold mb-2 tracking-tight">{tokenData.name}</h2>
            <p className="text-white/60 text-lg tracking-tight">{tokenData.symbol.toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-sm mb-2 tracking-tight">Current Price</p>
            <p className="text-4xl font-bold mb-2 tracking-tight">
              {formatNumber(marketData.current_price?.usd)}
            </p>
            <div className={`flex items-center justify-end gap-2 ${priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {priceChange24h >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
              <span className="text-lg font-medium tracking-tight">
                {formatPercentage(priceChange24h)}
              </span>
            </div>
          </div>
        </div>

        {tokenData.links?.homepage?.[0] && (
          <a
            href={tokenData.links.homepage[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all text-sm text-white/60 hover:text-white"
          >
            Visit Website
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </motion.div>

      {/* Price Changes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6 border border-white/[0.08]"
        >
          <p className="text-white/60 text-sm mb-2 tracking-tight">24h Change</p>
          <div className={`flex items-center gap-2 ${priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {priceChange24h >= 0 ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <TrendingDown className="w-5 h-5" />
            )}
            <span className="text-2xl font-bold tracking-tight">{formatPercentage(priceChange24h)}</span>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-6 border border-white/[0.08]"
        >
          <p className="text-white/60 text-sm mb-2 tracking-tight">7d Change</p>
          <div className={`flex items-center gap-2 ${priceChange7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {priceChange7d >= 0 ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <TrendingDown className="w-5 h-5" />
            )}
            <span className="text-2xl font-bold tracking-tight">{formatPercentage(priceChange7d)}</span>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-6 border border-white/[0.08]"
        >
          <p className="text-white/60 text-sm mb-2 tracking-tight">30d Change</p>
          <div className={`flex items-center gap-2 ${priceChange30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {priceChange30d >= 0 ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <TrendingDown className="w-5 h-5" />
            )}
            <span className="text-2xl font-bold tracking-tight">{formatPercentage(priceChange30d)}</span>
          </div>
        </motion.div>
      </div>

      {/* Market Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-6 border border-white/[0.08]"
        >
          <div className="flex items-center gap-3 mb-3">
            <DollarSign className="w-5 h-5 text-primary-400" />
            <p className="text-white/60 text-sm tracking-tight">Market Cap</p>
          </div>
          <p className="text-2xl font-bold tracking-tight">{formatNumber(marketData.market_cap?.usd)}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass rounded-2xl p-6 border border-white/[0.08]"
        >
          <div className="flex items-center gap-3 mb-3">
            <Activity className="w-5 h-5 text-primary-400" />
            <p className="text-white/60 text-sm tracking-tight">24h Volume</p>
          </div>
          <p className="text-2xl font-bold tracking-tight">{formatNumber(marketData.total_volume?.usd)}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass rounded-2xl p-6 border border-white/[0.08]"
        >
          <div className="flex items-center gap-3 mb-3">
            <BarChart3 className="w-5 h-5 text-primary-400" />
            <p className="text-white/60 text-sm tracking-tight">Circulating Supply</p>
          </div>
          <p className="text-2xl font-bold tracking-tight">
            {marketData.circulating_supply?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="glass rounded-2xl p-6 border border-white/[0.08]"
        >
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-5 h-5 text-primary-400" />
            <p className="text-white/60 text-sm tracking-tight">Total Supply</p>
          </div>
          <p className="text-2xl font-bold tracking-tight">
            {marketData.total_supply?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}
          </p>
        </motion.div>
      </div>

      {/* Price Ranges */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="glass rounded-2xl p-6 border border-white/[0.08]"
      >
        <h3 className="text-lg font-semibold mb-4 tracking-tight">Price Ranges (24h)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-white/60 text-sm mb-1 tracking-tight">High</p>
            <p className="text-white font-medium tracking-tight">{formatNumber(marketData.high_24h?.usd)}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1 tracking-tight">Low</p>
            <p className="text-white font-medium tracking-tight">{formatNumber(marketData.low_24h?.usd)}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1 tracking-tight">All-Time High</p>
            <p className="text-white font-medium tracking-tight">{formatNumber(marketData.ath?.usd)}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1 tracking-tight">All-Time Low</p>
            <p className="text-white font-medium tracking-tight">{formatNumber(marketData.atl?.usd)}</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default TokenAnalytics

