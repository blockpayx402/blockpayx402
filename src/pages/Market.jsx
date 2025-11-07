import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Search, Loader2, BarChart3, RefreshCw, ExternalLink, Twitter, Globe, Github, Youtube, MessageCircle, ChevronRight, Info } from 'lucide-react'

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
  const [activeTab, setActiveTab] = useState('overview')
  const [activeDescription, setActiveDescription] = useState('overview')
  const [priceRangePeriod, setPriceRangePeriod] = useState('24h')

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
          fetch(`https://api.coingecko.com/api/v3/coins/${selectedCoinId}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true&sparkline=false`, {
            signal: controller.signal,
          }),
          fetch(`https://api.coingecko.com/api/v3/coins/${selectedCoinId}/market_chart?vs_currency=usd&days=30&interval=daily`, {
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
        setCoinDetails({
          details: detailsData,
          chart: chartData?.prices || [],
          marketCaps: chartData?.market_caps || [],
          totalVolumes: chartData?.total_volumes || [],
        })
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

  const normalizeSparkline = (values, width = 200, height = 60) => {
    if (!Array.isArray(values) || values.length === 0) return ''
    const prices = values.map(point => point[1])
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min || 1

    return prices
      .map((price, index) => {
        const x = (index / (prices.length - 1 || 1)) * width
        const y = height - ((price - min) / range) * height
        return `${x},${y}`
      })
      .join(' ')
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

  const getPlatformContracts = (platforms) => {
    if (!platforms || typeof platforms !== 'object') return []
    return Object.entries(platforms)
      .filter(([_, address]) => typeof address === 'string' && address.trim() !== '')
      .map(([chain, address]) => ({ chain, address }))
      .slice(0, 6)
  }

  const formattedCoinDetails = useMemo(() => {
    if (!coinDetails || !coinDetails.details) return null
    const { details, chart } = coinDetails
    const marketData = details.market_data || {}

    const socialLinks = []
    if (details.links?.homepage?.[0]) {
      socialLinks.push({ label: 'Website', url: details.links.homepage[0], icon: Globe, color: 'text-primary-200' })
    }
    if (details.links?.twitter_screen_name) {
      socialLinks.push({ label: `@${details.links.twitter_screen_name}`, url: `https://twitter.com/${details.links.twitter_screen_name}`, icon: Twitter, color: 'text-sky-300' })
    }
    if (details.links?.subreddit_url) {
      socialLinks.push({ label: 'Reddit', url: details.links.subreddit_url, icon: MessageCircle, color: 'text-orange-200' })
    }
    if (details.links?.repos_url?.github?.[0]) {
      socialLinks.push({ label: 'GitHub', url: details.links.repos_url.github[0], icon: Github, color: 'text-white/80' })
    }
    if (details.links?.youtube_channel_ids?.[0]) {
      socialLinks.push({ label: 'YouTube', url: `https://www.youtube.com/${details.links.youtube_channel_ids[0]}`, icon: Youtube, color: 'text-red-300' })
    }

    const metrics = [
      {
        label: 'Market Cap',
        value: formatMarketCap(marketData.market_cap?.usd ?? 0),
        helper: 'Current market capitalization in USD.',
      },
      {
        label: 'Fully Diluted',
        value: formatMarketCap(marketData.fully_diluted_valuation?.usd ?? 0),
        helper: 'Value if maximum supply were in circulation.',
      },
      {
        label: 'Circulating Supply',
        value: marketData.circulating_supply ? `${Number(marketData.circulating_supply).toLocaleString()} ${details.symbol.toUpperCase()}` : '—',
        helper: 'Coins currently in circulation.',
      },
      {
        label: 'Total Volume (24h)',
        value: formatMarketCap(marketData.total_volume?.usd ?? 0),
        helper: 'Trading volume in the last 24 hours.',
      },
      {
        label: 'ATH',
        value: formatPrice(marketData.ath?.usd ?? 0),
        helper: marketData.ath_date?.usd ? `ATH set on ${new Date(marketData.ath_date.usd).toLocaleDateString()}` : '',
      },
      {
        label: 'ATL',
        value: formatPrice(marketData.atl?.usd ?? 0),
        helper: marketData.atl_date?.usd ? `ATL set on ${new Date(marketData.atl_date.usd).toLocaleDateString()}` : '',
      },
    ]

    return {
      details,
      chart,
      marketData,
      socialLinks,
      metrics,
      description: details.description?.en ? details.description.en.split('.').slice(0, 4).join('.') : '',
      platforms: getPlatformContracts(details.platforms),
      communityStats: {
        twitter: details.community_data?.twitter_followers?.toLocaleString() ?? '—',
        telegram: details.community_data?.telegram_channel_user_count?.toLocaleString() ?? '—',
        reddit: details.community_data?.reddit_subscribers?.toLocaleString() ?? '—',
      },
    }
  }, [coinDetails])

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
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
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

          {formattedCoinDetails && !detailsLoading && !detailsError && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-4">
              <img
                src={formattedCoinDetails.details.image?.large || formattedCoinDetails.details.image?.thumb}
                alt={formattedCoinDetails.details.name}
                className="w-16 h-16 rounded-full"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
              <div>
                <h2 className="text-3xl font-semibold text-white tracking-tight flex items-center gap-3">
                  {formattedCoinDetails.details.name}
                  <span className="text-sm uppercase text-white/40">{formattedCoinDetails.details.symbol}</span>
                </h2>
                <p className="text-white/50 text-sm tracking-tight flex items-center gap-2">
                  Rank #{formattedCoinDetails.details.market_cap_rank ?? '—'}
                  <a
                    href={formattedCoinDetails.details.links?.homepage?.[0] || `https://www.coingecko.com/en/coins/${formattedCoinDetails.details.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary-200 hover:text-primary-100 text-xs"
                  >
                    View on CoinGecko <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-white text-3xl font-semibold tracking-tight">
                {formatPrice(formattedCoinDetails.marketData.current_price?.usd ?? 0)}
              </div>
              <div className="text-white/40 text-xs tracking-tight">
                24h high {formatPrice(formattedCoinDetails.marketData.high_24h?.usd ?? 0)} • 24h low {formatPrice(formattedCoinDetails.marketData.low_24h?.usd ?? 0)}
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.08] pt-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/40 uppercase tracking-[0.2em]">
              <button
                className={`px-3 py-1 rounded-full border transition ${activeTab === 'overview' ? 'border-primary-500/60 text-primary-200' : 'border-white/10 hover:border-white/20'}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`px-3 py-1 rounded-full border transition ${activeTab === 'markets' ? 'border-primary-500/60 text-primary-200' : 'border-white/10 hover:border-white/20'}`}
                onClick={() => setActiveTab('markets')}
              >
                Metrics
              </button>
              <button
                className={`px-3 py-1 rounded-full border transition ${activeTab === 'social' ? 'border-primary-500/60 text-primary-200' : 'border-white/10 hover:border-white/20'}`}
                onClick={() => setActiveTab('social')}
              >
                Social
              </button>
              <button
                className={`px-3 py-1 rounded-full border transition ${activeTab === 'contracts' ? 'border-primary-500/60 text-primary-200' : 'border-white/10 hover:border-white/20'}`}
                onClick={() => setActiveTab('contracts')}
              >
                Contracts
              </button>
            </div>
          </div>

          {activeTab === 'overview' && (
            <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
              <div className="glass-strong rounded-2xl border border-white/10 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white/70 font-semibold tracking-tight">Price Performance</h3>
                  <div className="flex gap-2 text-xs text-white/40">
                    {['24h', '7d', '30d'].map(option => (
                      <button
                        key={option}
                        onClick={() => setPriceRangePeriod(option)}
                        className={`px-3 py-1 rounded-lg border transition ${priceRangePeriod === option ? 'border-primary-500/60 text-primary-200' : 'border-white/10 hover:border-white/20'}`}
                      >
                        {option.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <svg width="100%" height="180" viewBox="0 0 400 120" preserveAspectRatio="none" className="w-full">
                  <polyline
                    fill="none"
                    stroke="rgba(59,130,246,0.75)"
                    strokeWidth="2"
                    points={normalizeSparkline(formattedCoinDetails.chart, 400, 120)}
                  />
                </svg>
              </div>
              <div className="space-y-3">
                {formattedCoinDetails.metrics.slice(0, 4).map(metric => (
                  <div key={metric.label} className="glass-strong rounded-2xl border border-white/10 p-4">
                    <p className="text-white/40 text-xs uppercase tracking-[0.2em] flex items-center gap-2">
                      {metric.label}
                      {metric.helper && <Info className="w-3 h-3" />}
                    </p>
                    <p className="text-white text-lg font-semibold tracking-tight">{metric.value}</p>
                    {metric.helper && <p className="text-white/30 text-xs tracking-tight mt-1">{metric.helper}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'markets' && (
            <div className="grid gap-4 md:grid-cols-3">
              {formattedCoinDetails.metrics.map(metric => (
                <div key={metric.label} className="glass-strong rounded-2xl border border-white/10 p-4 space-y-2">
                  <p className="text-white/40 text-xs uppercase tracking-[0.2em] flex items-center gap-2">
                    {metric.label}
                    {metric.helper && <Info className="w-3 h-3" />}
                  </p>
                  <p className="text-white text-lg font-semibold tracking-tight">{metric.value}</p>
                  {metric.helper && <p className="text-white/30 text-xs tracking-tight">{metric.helper}</p>}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'social' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="glass-strong rounded-2xl border border-white/10 p-4 space-y-4">
                <h3 className="text-white/70 font-semibold tracking-tight">Community Statistics</h3>
                <div className="space-y-3 text-sm text-white/80">
                  <p>Twitter Followers: {formattedCoinDetails.communityStats.twitter}</p>
                  <p>Telegram Members: {formattedCoinDetails.communityStats.telegram}</p>
                  <p>Reddit Subscribers: {formattedCoinDetails.communityStats.reddit}</p>
                </div>
              </div>
              <div className="glass-strong rounded-2xl border border-white/10 p-4">
                <h3 className="text-white/70 font-semibold tracking-tight mb-3">Official Links</h3>
                <div className="flex flex-wrap gap-3">
                  {formattedCoinDetails.socialLinks.length === 0 && <p className="text-sm text-white/50">No social profiles available.</p>}
                  {formattedCoinDetails.socialLinks.map(link => (
                    <a
                      key={link.label}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-2 border border-white/10 rounded-lg px-3 py-2 text-sm hover:border-primary-500/40 transition ${link.color}`}
                    >
                      <link.icon className="w-4 h-4" /> {link.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contracts' && (
            <div className="glass-strong rounded-2xl border border-white/10 p-4 space-y-3">
              <h3 className="text-white/70 font-semibold tracking-tight">Contract Addresses</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {formattedCoinDetails.platforms.length === 0 && (
                  <p className="text-white/50 text-sm">No contract addresses available.</p>
                )}
                {formattedCoinDetails.platforms.map(platform => (
                  <div key={`${platform.chain}-${platform.address}`} className="glass rounded-xl border border-white/10 p-3 text-sm text-white/70 break-all">
                    <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-1">{platform.chain}</p>
                    <p>{platform.address}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {formattedCoinDetails.description && (
            <div className="glass-strong rounded-2xl border border-white/10 p-4 space-y-3">
              <h3 className="text-white/70 font-semibold tracking-tight">About {formattedCoinDetails.details.name}</h3>
              <p className="text-white/60 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedCoinDetails.description }} />
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

