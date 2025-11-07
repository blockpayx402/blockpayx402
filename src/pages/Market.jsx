import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Search, Loader2, BarChart3, RefreshCw, ExternalLink, Twitter, Globe, Github, Youtube, MessageCircle } from 'lucide-react'

const Market = () => {
  const [coins, setCoins] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [selectedCoinId, setSelectedCoinId] = useState(null)
  const [coinDetails, setCoinDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState(null)

  const PER_PAGE = 250

  useEffect(() => {
    const loadInitial = async () => {
      await fetchMarketData({ page: 1, append: false })
    }

    loadInitial()
  }, [])

  const fetchMarketData = async ({ page: pageToFetch = 1, append = false } = {}) => {
    try {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${PER_PAGE}&page=${pageToFetch}&sparkline=false&price_change_percentage=24h`
      )
      
      if (!response.ok) {
        throw new Error(response.status === 429 ? 'Rate limited by CoinGecko. Please wait a moment and try again.' : 'Failed to fetch market data')
      }
      
      const data = await response.json()
      if (!Array.isArray(data)) {
        throw new Error('Unexpected response format from CoinGecko')
      }

      // Filter out duplicates if API returns overlapping results
      setHasMore(Array.isArray(data) && data.length === PER_PAGE)
      setLastUpdated(new Date().toISOString())

      setCoins(prevCoins => {
        if (!append) {
          setPage(pageToFetch)
          return data
        }

        const existingIds = new Set(prevCoins.map(coin => coin.id))
        const merged = [...prevCoins]

        data.forEach(coin => {
          if (coin?.id && !existingIds.has(coin.id)) {
            merged.push(coin)
          }
        })

        setPage(pageToFetch)
        return merged
      })
    } catch (err) {
      console.error('Error fetching market data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const handleRefresh = () => {
    fetchMarketData({ page: 1, append: false })
  }

  const handleLoadMore = () => {
    if (loadingMore || !hasMore || error) return
    fetchMarketData({ page: page + 1, append: true })
  }

  const filteredCoins = coins.filter(coin =>
    coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    if (!selectedCoinId) {
      setCoinDetails(null)
      setDetailsError(null)
      return
    }

    const controller = new AbortController()

    const fetchDetails = async () => {
      try {
        setDetailsLoading(true)
        setDetailsError(null)

        const [detailsRes, chartRes] = await Promise.all([
          fetch(`https://api.coingecko.com/api/v3/coins/${selectedCoinId}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false&sparkline=false`, {
            signal: controller.signal,
          }),
          fetch(`https://api.coingecko.com/api/v3/coins/${selectedCoinId}/market_chart?vs_currency=usd&days=7&interval=hourly`, {
            signal: controller.signal,
          }),
        ])

        if (!detailsRes.ok) {
          throw new Error('Unable to load coin details')
        }

        if (!chartRes.ok) {
          throw new Error('Unable to load price history')
        }

        const [detailsData, chartData] = await Promise.all([detailsRes.json(), chartRes.json()])
        setCoinDetails({ details: detailsData, chart: chartData?.prices || [] })
      } catch (err) {
        if (err.name === 'AbortError') return
        console.error('Error loading coin details:', err)
        setDetailsError(err.message)
      } finally {
        setDetailsLoading(false)
      }
    }

    fetchDetails()

    return () => controller.abort()
  }, [selectedCoinId])

  const normalizeSparkline = (values) => {
    if (!Array.isArray(values) || values.length === 0) return ''
    const prices = values.map(point => point[1])
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min || 1
    const width = 200
    const height = 60

    return prices
      .map((price, index) => {
        const x = (index / (prices.length - 1 || 1)) * width
        const y = height - ((price - min) / range) * height
        return `${x},${y}`
      })
      .join(' ')
  }

  const getPlatformContracts = (platforms) => {
    if (!platforms || typeof platforms !== 'object') return []
    return Object.entries(platforms)
      .filter(([_, address]) => typeof address === 'string' && address.trim() !== '')
      .map(([chain, address]) => ({ chain, address }))
      .slice(0, 6)
  }

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
          <p className="text-white/60 text-lg tracking-tight">
            Real-time cryptocurrency prices and market data. Powered by CoinGecko.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Reload Data
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
            onClick={handleRefresh}
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
                      className={`border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors cursor-pointer ${
                        selectedCoinId === coin.id ? 'bg-primary-500/10' : ''
                      }`}
                      onClick={() => setSelectedCoinId(prev => (prev === coin.id ? null : coin.id))}
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

      {hasMore && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex justify-center"
        >
          <button
            onClick={handleLoadMore}
            disabled={loadingMore || error}
            className="px-5 py-3 glass-strong rounded-xl border border-white/10 hover:border-primary-500/40 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            Load more markets
          </button>
        </motion.div>
      )}

      {selectedCoinId && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-3xl border border-white/[0.08] p-6 space-y-6"
        >
          {detailsLoading && (
            <div className="flex items-center gap-3 text-white/60">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading coin details...
            </div>
          )}

          {detailsError && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
              {detailsError}
            </div>
          )}

          {coinDetails && !detailsLoading && !detailsError && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={coinDetails.details.image?.large || coinDetails.details.image?.small || coinDetails.details.image?.thumb}
                    alt={coinDetails.details.name}
                    className="w-16 h-16 rounded-full"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                  <div>
                    <h2 className="text-3xl font-semibold text-white tracking-tight flex items-center gap-3">
                      {coinDetails.details.name}
                      <span className="text-sm uppercase text-white/40">{coinDetails.details.symbol}</span>
                    </h2>
                    <p className="text-white/50 text-sm tracking-tight">
                      Market Cap Rank: #{coinDetails.details.market_cap_rank ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-white text-2xl font-semibold tracking-tight">
                    {formatPrice(coinDetails.details.market_data?.current_price?.usd ?? 0)}
                  </div>
                  <div className="text-white/40 text-xs tracking-tight">
                    24h high: {formatPrice(coinDetails.details.market_data?.high_24h?.usd ?? 0)} • 24h low: {formatPrice(coinDetails.details.market_data?.low_24h?.usd ?? 0)}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="glass-strong rounded-2xl border border-white/10 p-4 space-y-2">
                  <p className="text-white/40 text-xs uppercase tracking-[0.2em]">ATH</p>
                  <p className="text-white text-lg font-semibold tracking-tight">
                    {formatPrice(coinDetails.details.market_data?.ath?.usd ?? 0)}
                  </p>
                  <p className="text-white/30 text-xs tracking-tight">
                    {coinDetails.details.market_data?.ath_date?.usd ? new Date(coinDetails.details.market_data.ath_date.usd).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="glass-strong rounded-2xl border border-white/10 p-4 space-y-2">
                  <p className="text-white/40 text-xs uppercase tracking-[0.2em]">ATL</p>
                  <p className="text-white text-lg font-semibold tracking-tight">
                    {formatPrice(coinDetails.details.market_data?.atl?.usd ?? 0)}
                  </p>
                  <p className="text-white/30 text-xs tracking-tight">
                    {coinDetails.details.market_data?.atl_date?.usd ? new Date(coinDetails.details.market_data.atl_date.usd).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="glass-strong rounded-2xl border border-white/10 p-4 space-y-2">
                  <p className="text-white/40 text-xs uppercase tracking-[0.2em]">Market Cap</p>
                  <p className="text-white text-lg font-semibold tracking-tight">
                    {formatMarketCap(coinDetails.details.market_data?.market_cap?.usd ?? 0)}
                  </p>
                </div>
                <div className="glass-strong rounded-2xl border border-white/10 p-4 space-y-2">
                  <p className="text-white/40 text-xs uppercase tracking-[0.2em]">Twitter</p>
                  <p className="text-white text-lg font-semibold tracking-tight">
                    {coinDetails.details.community_data?.twitter_followers?.toLocaleString() ?? '—'}
                  </p>
                  <p className="text-white/30 text-xs tracking-tight">Followers</p>
                </div>
              </div>

              <div className="glass-strong rounded-2xl border border-white/10 p-4">
                <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-3">7D Price</p>
                <svg width="100%" height="60" viewBox="0 0 200 60" preserveAspectRatio="none" className="w-full">
                  <polyline
                    fill="none"
                    stroke="rgba(56,189,248,0.85)"
                    strokeWidth="2"
                    points={normalizeSparkline(coinDetails.chart)}
                  />
                </svg>
              </div>

              <div className="glass-strong rounded-2xl border border-white/10 p-4 space-y-3">
                <p className="text-white/40 text-xs uppercase tracking-[0.2em]">Contracts</p>
                <div className="grid md:grid-cols-2 gap-3">
                  {getPlatformContracts(coinDetails.details.platforms).length === 0 && (
                    <p className="text-white/50 text-sm">No contract addresses available.</p>
                  )}
                  {getPlatformContracts(coinDetails.details.platforms).map(platform => (
                    <div
                      key={`${platform.chain}-${platform.address}`}
                      className="glass rounded-xl border border-white/10 p-3 text-sm text-white/70 break-all"
                    >
                      <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-1">{platform.chain}</p>
                      <p>{platform.address}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-strong rounded-2xl border border-white/10 p-4">
                <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-3">Links</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  {coinDetails.details.links?.homepage?.[0] && (
                    <a
                      href={coinDetails.details.links.homepage[0]}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-primary-200 hover:text-primary-100"
                    >
                      <Globe className="w-4 h-4" /> Website
                    </a>
                  )}
                  {coinDetails.details.links?.twitter_screen_name && (
                    <a
                      href={`https://twitter.com/${coinDetails.details.links.twitter_screen_name}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sky-300 hover:text-sky-200"
                    >
                      <Twitter className="w-4 h-4" /> @{coinDetails.details.links.twitter_screen_name}
                    </a>
                  )}
                  {coinDetails.details.links?.subreddit_url && (
                    <a
                      href={coinDetails.details.links.subreddit_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-orange-200 hover:text-orange-100"
                    >
                      <MessageCircle className="w-4 h-4" /> Reddit
                    </a>
                  )}
                  {coinDetails.details.links?.repos_url?.github?.[0] && (
                    <a
                      href={coinDetails.details.links.repos_url.github[0]}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-white/80 hover:text-white"
                    >
                      <Github className="w-4 h-4" /> GitHub
                    </a>
                  )}
                  {coinDetails.details.links?.youtube_channel_ids?.[0] && (
                    <a
                      href={`https://www.youtube.com/${coinDetails.details.links.youtube_channel_ids[0]}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-red-300 hover:text-red-200"
                    >
                      <Youtube className="w-4 h-4" /> YouTube
                    </a>
                  )}
                  {coinDetails.details.links?.announcement_url?.[0] && (
                    <a
                      href={coinDetails.details.links.announcement_url[0]}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-white/70 hover:text-white"
                    >
                      <ExternalLink className="w-4 h-4" /> Announcements
                    </a>
                  )}
                </div>
              </div>

              {coinDetails.details.description?.en && (
                <div className="glass rounded-2xl border border-white/10 p-4 space-y-2">
                  <p className="text-white/40 text-xs uppercase tracking-[0.2em]">About</p>
                  <p
                    className="text-white/60 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: coinDetails.details.description.en.split('.').slice(0, 3).join('.') }}
                  />
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Info Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center text-white/40 text-xs tracking-tight"
      >
        <p>
          Data provided by CoinGecko API • {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : 'Awaiting data'}
        </p>
      </motion.div>
    </div>
  )
}

export default Market

