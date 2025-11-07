import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { Loader2, ArrowLeftRight, ExternalLink, Search } from 'lucide-react'

const FALLBACK_TOKENS = [
  {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
  },
  {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  {
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether',
    decimals: 6,
  },
  {
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xKmS4MJSaDvsks',
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
  },
]

const JUPITER_TOKEN_SOURCES = [
  'https://cache.jup.ag/tokens',
  'https://token.jup.ag/strict',
  'https://token.jup.ag/all',
  'https://tokens.jup.ag/tokens?tags=verified,community,strict',
]

const buildSingleTokenEndpoints = (mint) => [
  `https://token.jup.ag/strict/${mint}`,
  `https://token.jup.ag/community/${mint}`,
  `https://token.jup.ag/all/${mint}`,
  `https://token.jup.ag/verified/${mint}`,
  `https://token.jup.ag/extended/${mint}`,
  `https://tokens.jup.ag/token/${mint}`,
  `https://cache.jup.ag/token/${mint}`,
]

const normalizeTokenMetadata = (rawToken, fallbackMint) => {
  if (!rawToken && !fallbackMint) return null

  const address = rawToken?.address || rawToken?.mint || rawToken?.id || fallbackMint
  if (!address) return null

  const decimalsValue = rawToken?.decimals ?? rawToken?.decimal ?? 9
  const decimals = Number.isFinite(Number(decimalsValue)) ? Number(decimalsValue) : 9

  const symbol = rawToken?.symbol || rawToken?.ticker || rawToken?.tokenSymbol || 'UNKNOWN'
  const name = rawToken?.name || rawToken?.tokenName || rawToken?.symbol || symbol || 'Unknown Token'

  return {
    address,
    symbol,
    name,
    decimals,
  }
}

const fetchTokenMetadataFromJupiter = async (mint) => {
  const endpoints = buildSingleTokenEndpoints(mint)

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        continue
      }

      const payload = await response.json()

      let candidate = null
      if (Array.isArray(payload)) {
        candidate = payload[0]
      } else if (payload?.data) {
        candidate = Array.isArray(payload.data) ? payload.data[0] : payload.data
      } else if (payload?.token) {
        candidate = payload.token
      } else {
        candidate = payload
      }

      const normalized = normalizeTokenMetadata(candidate, mint)
      if (normalized?.address) {
        return normalized
      }
    } catch (error) {
      // Try next endpoint
      continue
    }
  }

  return null
}

const buildFallbackToken = (mint) => {
  const safeMint = (mint || '').trim()
  if (!safeMint) return null

  const short = `${safeMint.slice(0,4)}...${safeMint.slice(-4)}`

  return {
    address: safeMint,
    symbol: short,
    name: safeMint,
    decimals: 9,
    isFallback: true,
  }
}

const isMaybeMint = (value) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test((value || '').trim())

const formatNumber = (value, decimals = 6) => {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: decimals })
  return value.toPrecision(4)
}

const TokenSelector = ({ label, tokens, value, onChange, onResolveMint }) => {
  const [query, setQuery] = useState('')
  const [resolvingMint, setResolvingMint] = useState(false)

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return tokens.slice(0, 200)
    return tokens
      .filter(token =>
        token.symbol?.toLowerCase().includes(search) ||
        token.name?.toLowerCase().includes(search) ||
        token.address?.toLowerCase() === search
      )
      .slice(0, 200)
  }, [query, tokens])

  const handleUseMint = async () => {
    const mint = query.trim()
    if (!isMaybeMint(mint)) {
      toast.error('Enter a valid Solana mint address')
      return
    }

    try {
      setResolvingMint(true)
      onChange(mint)
      const resolved = await onResolveMint?.(mint)

      if (resolved?.address) {
        onChange(resolved.address)
      } else {
        onChange(mint)
      }
    } catch (error) {
      const message = error?.message || 'Unable to load token metadata. Using fallback info.'
      toast.error(message)
      onChange(mint)
    } finally {
      setResolvingMint(false)
      setQuery('')
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm text-white/60 tracking-tight">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search symbol, name, or paste mint"
          className="w-full pl-10 pr-28 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 bg-white/[0.04] text-white placeholder:text-white/30"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
          <button
            onClick={() => setQuery('')}
            className="px-3 py-1 text-xs glass-strong rounded-lg border border-white/10 text-white/60 hover:text-white"
          >
            Clear
          </button>
          <button
            onClick={handleUseMint}
            disabled={resolvingMint}
            className="px-3 py-1 text-xs bg-primary-500/20 border border-primary-500/40 text-primary-100 rounded-lg hover:bg-primary-500/30 disabled:opacity-50"
          >
            {resolvingMint ? 'Loading...' : 'Use Mint'}
          </button>
        </div>
      </div>

      <div className="max-h-56 overflow-y-auto glass rounded-xl border border-white/10">
        {filtered.map(token => (
          <button
            key={token.address}
            onClick={() => onChange(token.address)}
            className={`w-full text-left px-4 py-2 border-b border-white/5 hover:bg-white/[0.04] transition ${value === token.address ? 'bg-primary-500/10' : ''}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-white tracking-tight font-medium">
                  {token.symbol}{' '}
                  <span className="text-white/40 font-normal">— {token.name}</span>
                </div>
                <div className="text-xs text-white/40 font-mono break-all">{token.address}</div>
              </div>
              <span className="text-xs text-white/40">decimals: {token.decimals ?? '—'}</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-6 text-sm text-white/40">
            No matches. Paste a mint address above and click “Use Mint”.
          </div>
        )}
      </div>
    </div>
  )
}

const Swapper = () => {
  const [tokens, setTokens] = useState(FALLBACK_TOKENS)
  const [loadingTokens, setLoadingTokens] = useState(true)
  const [fromMint, setFromMint] = useState(FALLBACK_TOKENS[1].address)
  const [toMint, setToMint] = useState(FALLBACK_TOKENS[0].address)
  const [amount, setAmount] = useState('1')
  const [jupiterQuote, setJupiterQuote] = useState(null)
  const [jupiterQuoting, setJupiterQuoting] = useState(false)
  const [jupiterError, setJupiterError] = useState(null)

  const ensureTokenMetadata = useCallback(async (mint) => {
    const normalizedMint = (mint || '').trim()
    if (!normalizedMint) return null

    const lowerMint = normalizedMint.toLowerCase()

    let existingToken = null
    setTokens(prevTokens => {
      const withoutMint = prevTokens.filter(token => token.address?.toLowerCase() !== lowerMint)
      existingToken = prevTokens.find(token => token.address?.toLowerCase() === lowerMint)

      if (existingToken) {
        return [existingToken, ...withoutMint]
      }

      const fallbackToken = buildFallbackToken(normalizedMint)
      existingToken = fallbackToken
      return fallbackToken ? [fallbackToken, ...withoutMint] : withoutMint
    })

    if (existingToken && !existingToken.isFallback) {
      // Already have metadata, no need to fetch again
      return existingToken
    }

    try {
      const tokenMetadata = await fetchTokenMetadataFromJupiter(normalizedMint)
      if (tokenMetadata) {
        setTokens(prevTokens => {
          const withoutMint = prevTokens.filter(token => token.address?.toLowerCase() !== lowerMint)
          return [tokenMetadata, ...withoutMint]
        })
        return tokenMetadata
      }
    } catch (error) {
      // Ignore fetch errors, fallback already applied
    }

    return existingToken || buildFallbackToken(normalizedMint)
  }, [])

  useEffect(() => {
    const loadTokens = async () => {
      setLoadingTokens(true)
      try {
        let fetchedTokens = null

        for (const source of JUPITER_TOKEN_SOURCES) {
          try {
            const response = await fetch(source, {
              headers: {
                'Accept': 'application/json',
              },
            })

            if (!response.ok) {
              continue
            }

            const payload = await response.json()
            const tokensArray = Array.isArray(payload)
              ? payload
              : Array.isArray(payload?.data)
                ? payload.data
                : Array.isArray(payload?.tokens)
                  ? payload.tokens
                  : []

            if (tokensArray.length > 0) {
              fetchedTokens = tokensArray
              break
            }
          } catch (innerError) {
            // Try next source
            continue
          }
        }

        if (Array.isArray(fetchedTokens) && fetchedTokens.length > 0) {
          setTokens(fetchedTokens)
          const defaultFrom = fetchedTokens.find(t => t.symbol === 'USDC') ?? fetchedTokens[0]
          const defaultTo = fetchedTokens.find(t => t.symbol === 'SOL') ?? fetchedTokens[1] ?? fetchedTokens[0]
          setFromMint(defaultFrom.address)
          setToMint(defaultTo.address)
          return
        }

        toast.error('Unable to load Jupiter token list. Using default tokens.')
      } finally {
        setLoadingTokens(false)
      }
    }

    loadTokens()
  }, [])

  const fromToken = useMemo(() => tokens.find(token => token.address === fromMint), [tokens, fromMint])
  const toToken = useMemo(() => tokens.find(token => token.address === toMint), [tokens, toMint])

  const amountInBaseUnits = useMemo(() => {
    const decimals = fromToken?.decimals ?? 9
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return null
    return Math.floor(value * Math.pow(10, decimals))
  }, [amount, fromToken])

  const handleSwapMints = () => {
    setFromMint(toMint)
    setToMint(fromMint)
    setJupiterQuote(null)
    setJupiterError(null)
  }

  const fetchQuote = async () => {
    setJupiterError(null)
    setJupiterQuote(null)

    if (!isMaybeMint(fromMint) || !isMaybeMint(toMint)) {
      setJupiterError('Select valid input and output token mints')
      return
    }

    if (!amountInBaseUnits) {
      setJupiterError('Enter a valid amount greater than zero')
      return
    }

    setJupiterQuoting(true)
    try {
      const params = new URLSearchParams({
        inputMint: fromMint,
        outputMint: toMint,
        amount: String(amountInBaseUnits),
        slippageBps: '50',
      })

      const response = await fetch(`https://quote-api.jup.ag/v6/quote?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`Quote failed (${response.status})`)
      }
      const data = await response.json()
      setJupiterQuote(data?.data?.[0] || data)
    } catch (err) {
      setJupiterError('Unable to fetch quote for this pair right now')
    } finally {
      setJupiterQuoting(false)
    }
  }

  const jupiterLink = useMemo(() => {
    if (!isMaybeMint(fromMint) || !isMaybeMint(toMint)) return '#'
    const params = new URLSearchParams({
      sell: fromMint,
      buy: toMint,
    })
    return `https://jup.ag/swap?${params.toString()}`
  }, [fromMint, toMint])

  const estimatedOutput = useMemo(() => {
    if (!jupiterQuote) return null
    const rawOut = Number(jupiterQuote.outAmount || jupiterQuote.outputAmount || jupiterQuote.estimatedOutputAmount || jupiterQuote.toAmount)
    if (!Number.isFinite(rawOut)) return null
    const decimals = toToken?.decimals ?? 9
    return rawOut / Math.pow(10, decimals)
  }, [jupiterQuote, toToken])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-4xl font-semibold gradient-text tracking-tight">Swap Assets</h1>
          <p className="text-white/60 text-sm tracking-tight">Live quotes powered by Jupiter Aggregator</p>
        </div>
        <button
          onClick={fetchQuote}
          disabled={jupiterQuoting}
          className="inline-flex items-center gap-2 px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/40 transition disabled:opacity-50"
        >
          {jupiterQuoting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Get Quote'}
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-3xl border border-white/[0.08] p-6"
      >
        <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60 tracking-tight">Amount</span>
              <span className="text-xs text-white/40 tracking-tight">From</span>
            </div>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 bg-white/[0.04] text-white"
            />
            <TokenSelector
              label={loadingTokens ? 'Loading tokens…' : 'Input token'}
              tokens={tokens}
              value={fromMint}
              onChange={setFromMint}
              onResolveMint={ensureTokenMetadata}
            />
          </div>

          <div className="hidden md:flex items-center justify-center">
            <button
              onClick={handleSwapMints}
              className="w-12 h-12 rounded-2xl bg-primary-500/10 border border-primary-500/40 text-primary-200 hover:bg-primary-500/20 transition"
            >
              <ArrowLeftRight className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <span className="text-sm text-white/60 tracking-tight">To</span>
            <TokenSelector
              label={loadingTokens ? 'Loading tokens…' : 'Output token'}
              tokens={tokens}
              value={toMint}
              onChange={setToMint}
              onResolveMint={ensureTokenMetadata}
            />
          </div>
        </div>

        {jupiterError && (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            {jupiterError}
          </div>
        )}

        {jupiterQuote && !jupiterError && (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="glass-strong rounded-2xl border border-white/10 p-5">
              <p className="text-sm text-white/40 tracking-tight mb-2">You send</p>
              <p className="text-2xl font-semibold text-white tracking-tight">
                {formatNumber(Number(amount))} {fromToken?.symbol || 'TOKEN'}
              </p>
            </div>
            <div className="glass-strong rounded-2xl border border-white/10 p-5">
              <p className="text-sm text-white/40 tracking-tight mb-2">You receive (est.)</p>
              <p className="text-2xl font-semibold text-white tracking-tight">
                {formatNumber(estimatedOutput ?? Number.NaN)} {toToken?.symbol || 'TOKEN'}
              </p>
            </div>
            <div className="glass-strong rounded-2xl border border-white/10 p-5">
              <p className="text-sm text-white/40 tracking-tight mb-2">Route</p>
              <p className="text-sm text-white/60 tracking-tight">
                {jupiterQuote.marketInfos?.map(info => info.label || info.name).join(' → ') || 'Best route'}
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <a
            href={jupiterLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500/20 border border-primary-500/40 text-primary-100 hover:bg-primary-500/30 transition"
          >
            Open in Jupiter
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-center text-xs text-white/40 tracking-tight"
      >
        Quotes provided by Jupiter • Paste any Solana mint to swap instantly
      </motion.div>

      {/* Relay-based swap flow removed */}
    </div>
  )
}

export default Swapper
