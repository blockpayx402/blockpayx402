import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { Loader2, ArrowLeftRight, ExternalLink, Search, AlertTriangle, Wallet, Copy } from 'lucide-react'
import { ordersAPI, relayAPI } from '../services/api'

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

const isMaybeMint = (value) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test((value || '').trim())

const formatNumber = (value, decimals = 6) => {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: decimals })
  return value.toPrecision(4)
}

const TokenSelector = ({ label, tokens, value, onChange }) => {
  const [query, setQuery] = useState('')

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

  const handleUseMint = () => {
    const mint = query.trim()
    if (!isMaybeMint(mint)) {
      toast.error('Enter a valid Solana mint address')
      return
    }
    onChange(mint)
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
            className="px-3 py-1 text-xs bg-primary-500/20 border border-primary-500/40 text-primary-100 rounded-lg hover:bg-primary-500/30"
          >
            Use Mint
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

  const [chains, setChains] = useState([])
  const [chainsLoading, setChainsLoading] = useState(true)
  const [fromChainValue, setFromChainValue] = useState('')
  const [toChainValue, setToChainValue] = useState('')
  const [fromTokens, setFromTokens] = useState([])
  const [toTokens, setToTokens] = useState([])
  const [fromTokensLoading, setFromTokensLoading] = useState(false)
  const [toTokensLoading, setToTokensLoading] = useState(false)
  const [fromTokenSymbol, setFromTokenSymbol] = useState('')
  const [toTokenSymbol, setToTokenSymbol] = useState('')
  const [relayQuote, setRelayQuote] = useState(null)
  const [relayQuoteError, setRelayQuoteError] = useState(null)
  const [relayQuoting, setRelayQuoting] = useState(false)
  const [recipientAddress, setRecipientAddress] = useState('')
  const [refundAddress, setRefundAddress] = useState('')
  const [orderResponse, setOrderResponse] = useState(null)
  const [orderLoading, setOrderLoading] = useState(false)
  const relayQuoteDebounceRef = useRef(null)

  useEffect(() => {
    const loadTokens = async () => {
      setLoadingTokens(true)
      try {
        const response = await fetch('https://tokens.jup.ag/tokens?tags=verified,community,strict')
        const data = await response.json()
        if (Array.isArray(data) && data.length > 0) {
          setTokens(data)
          const defaultFrom = data.find(t => t.symbol === 'USDC') ?? data[0]
          const defaultTo = data.find(t => t.symbol === 'SOL') ?? data[1] ?? data[0]
          setFromMint(defaultFrom.address)
          setToMint(defaultTo.address)
        }
      } catch (err) {
        toast.error('Unable to load Jupiter token list. Using default tokens.')
      } finally {
        setLoadingTokens(false)
      }
    }

    loadTokens()
  }, [])

  useEffect(() => {
    const fetchChains = async () => {
      setChainsLoading(true)
      try {
        const data = await relayAPI.getChains()
        if (Array.isArray(data) && data.length > 0) {
          setChains(data)

          setFromChainValue(prev => prev || data[0].value)
          const fallbackToChain = data.find(chain => chain.value !== data[0].value) || data[0]
          setToChainValue(prev => prev || fallbackToChain.value)

          const initialFromTokens = Array.isArray(data[0].tokens) ? data[0].tokens : []
          const initialToTokens = Array.isArray(fallbackToChain.tokens) ? fallbackToChain.tokens : []

          if (initialFromTokens.length > 0) {
            setFromTokens(prev => (prev.length > 0 ? prev : initialFromTokens))
            setFromTokenSymbol(prev => prev || initialFromTokens[0].symbol)
          }

          if (initialToTokens.length > 0) {
            setToTokens(prev => (prev.length > 0 ? prev : initialToTokens))
            setToTokenSymbol(prev => prev || initialToTokens[0].symbol)
          }
        } else {
          setChains([])
        }
      } catch (error) {
        console.error('Error loading Relay chains:', error)
        toast.error('Unable to load Relay chains right now')
        setChains([])
      } finally {
        setChainsLoading(false)
      }
    }

    fetchChains()
  }, [])

  const resolveChainParam = useCallback((value) => {
    if (!value) return ''
    const chain = chains.find(item => item.value === value)
    if (!chain) return String(value)
    return chain.chainId?.toString() || String(chain.value)
  }, [chains])

  const loadTokensForChain = useCallback(async (
    chainValue,
    { setTokensState, setTokenSymbolState, setLoadingState }
  ) => {
    if (!chainValue) {
      setTokensState([])
      setTokenSymbolState('')
      return
    }

    setLoadingState(true)
    setTokensState([])
    try {
      const chain = chains.find(item => item.value === chainValue)
      const chainId = chain?.chainId ?? chainValue
      let tokensList = Array.isArray(chain?.tokens) ? chain.tokens : []

      if ((!tokensList || tokensList.length === 0) && chainId) {
        tokensList = await relayAPI.getTokens(chainId)
      }

      setTokensState(tokensList ? [...tokensList] : [])
      setTokenSymbolState(prev => {
        if (prev && tokensList?.some(token => token.symbol === prev)) {
          return prev
        }
        return tokensList && tokensList.length > 0 ? tokensList[0].symbol : ''
      })
    } catch (error) {
      console.error('Error loading Relay tokens:', error)
      toast.error('Unable to load tokens for the selected chain')
      setTokensState([])
      setTokenSymbolState('')
    } finally {
      setLoadingState(false)
    }
  }, [chains])

  useEffect(() => {
    if (!fromChainValue) return
    loadTokensForChain(fromChainValue, {
      setTokensState: setFromTokens,
      setTokenSymbolState: setFromTokenSymbol,
      setLoadingState: setFromTokensLoading,
    })
  }, [fromChainValue, loadTokensForChain])

  useEffect(() => {
    if (!toChainValue) return
    loadTokensForChain(toChainValue, {
      setTokensState: setToTokens,
      setTokenSymbolState: setToTokenSymbol,
      setLoadingState: setToTokensLoading,
    })
  }, [toChainValue, loadTokensForChain])

  useEffect(() => {
    if (relayQuoteDebounceRef.current) {
      clearTimeout(relayQuoteDebounceRef.current)
      relayQuoteDebounceRef.current = null
    }

    const numericAmount = Number(amount)
    if (
      !fromChainValue ||
      !toChainValue ||
      !fromTokenSymbol ||
      !toTokenSymbol ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setRelayQuote(null)
      setRelayQuoting(false)
      setRelayQuoteError(null)
      return
    }

    relayQuoteDebounceRef.current = setTimeout(async () => {
      setRelayQuoteError(null)
      setRelayQuoting(true)
      try {
        const payload = {
          fromChain: resolveChainParam(fromChainValue),
          fromAsset: fromTokenSymbol,
          toChain: resolveChainParam(toChainValue),
          toAsset: toTokenSymbol,
          amount: numericAmount,
          direction: 'forward',
        }

        const rateData = await ordersAPI.getExchangeRate(payload)
        const estimatedToAmount = rateData.estimatedAmount ?? rateData.estimatedToAmount ?? null
        const normalizedQuote = {
          ...rateData,
          fromAmount: numericAmount,
          estimatedToAmount,
          rate: rateData.exchangeRate ?? rateData.rate ?? (
            estimatedToAmount && numericAmount
              ? Number(estimatedToAmount) / numericAmount
              : null
          ),
          fetchedAt: Date.now(),
        }

        setRelayQuote(normalizedQuote)
      } catch (error) {
        console.error('Error fetching Relay quote:', error)
        const message = error?.response?.data?.error || error.message || 'Unable to fetch quote'
        setRelayQuote(null)
        setRelayQuoteError(message)
      } finally {
        setRelayQuoting(false)
      }
    }, 400)

    return () => {
      if (relayQuoteDebounceRef.current) {
        clearTimeout(relayQuoteDebounceRef.current)
        relayQuoteDebounceRef.current = null
      }
    }
  }, [amount, fromChainValue, fromTokenSymbol, toChainValue, toTokenSymbol, resolveChainParam])

  const formatAmount = useCallback((value) => {
    const numeric = typeof value === 'string' ? Number(value) : value
    if (!Number.isFinite(numeric)) return '—'
    if (numeric === 0) return '0'
    if (Math.abs(numeric) >= 1) {
      return numeric.toLocaleString(undefined, { maximumFractionDigits: 4 })
    }
    return numeric.toPrecision(4)
  }, [])

  const computedRate = useMemo(() => {
    if (!relayQuote) return null
    if (relayQuote.rate) {
      const rateNum = Number(relayQuote.rate)
      return Number.isFinite(rateNum) ? rateNum : null
    }
    if (relayQuote.estimatedToAmount && relayQuote.fromAmount) {
      const estimated = Number(relayQuote.estimatedToAmount)
      const input = Number(relayQuote.fromAmount)
      if (Number.isFinite(estimated) && Number.isFinite(input) && input > 0) {
        return estimated / input
      }
    }
    return null
  }, [relayQuote])

  const canQuote = useMemo(() => {
    const numericAmount = Number(amount)
    return Boolean(
      fromChainValue &&
      toChainValue &&
      fromTokenSymbol &&
      toTokenSymbol &&
      Number.isFinite(numericAmount) &&
      numericAmount > 0 &&
      recipientAddress.trim() &&
      relayQuote &&
      !relayQuoteError
    )
  }, [amount, fromChainValue, fromTokenSymbol, recipientAddress, relayQuote, relayQuoteError, toChainValue, toTokenSymbol])

  const handleSwapDirection = () => {
    setFromChainValue(toChainValue)
    setToChainValue(fromChainValue)
    setFromTokenSymbol(toTokenSymbol)
    setToTokenSymbol(fromTokenSymbol)
    setRelayQuote(null)
    setRelayQuoteError(null)
    setOrderResponse(null)
  }

  const handleCopy = async (value, label = 'Copied') => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied to clipboard`)
    } catch (error) {
      console.error('Clipboard copy failed:', error)
      toast.error('Unable to copy to clipboard')
    }
  }

  const handleCreateOrder = async () => {
    if (!canQuote) {
      toast.error('Complete the swap details and wait for a quote before creating an order')
      return
    }

    setOrderLoading(true)
    try {
      const payload = {
        requestId: null,
        fromChain: resolveChainParam(fromChainValue),
        fromAsset: fromTokenSymbol,
        amount: Number(amount),
        toChain: resolveChainParam(toChainValue),
        toAsset: toTokenSymbol,
        recipientAddress: recipientAddress.trim(),
        refundAddress: refundAddress.trim() || null,
      }

      const response = await ordersAPI.create(payload)
      setOrderResponse(response)
      toast.success('Swap order created!')
    } catch (error) {
      console.error('Error creating swap order:', error)
      const message = error?.response?.data?.error || error.message || 'Failed to create swap order'
      toast.error(message)
      setOrderResponse(null)
    } finally {
      setOrderLoading(false)
    }
  }

  const fromToken = useMemo(() => tokens.find(token => token.address === fromMint), [tokens, fromMint])
  const toToken = useMemo(() => tokens.find(token => token.address === toMint), [tokens, toMint])

  const relayFromToken = useMemo(() => fromTokens.find(token => token.symbol === fromTokenSymbol), [fromTokens, fromTokenSymbol])
  const relayToToken = useMemo(() => toTokens.find(token => token.symbol === toTokenSymbol), [toTokens, toTokenSymbol])

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
    return `https://jup.ag/swap/${fromMint}-${toMint}`
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

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-3xl border border-white/[0.08] p-6"
      >
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/70 tracking-tight">You Pay</span>
              <span className="text-xs uppercase text-white/30 tracking-[0.2em]">FROM</span>
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-white/50 tracking-tight">Chain</label>
              <select
                value={fromChainValue}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setFromChainValue(nextValue)
                  setRelayQuote(null)
                  setRelayQuoteError(null)
                  setOrderResponse(null)
                }}
                className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 bg-white/[0.04] text-white"
              >
                {chainsLoading && <option value="">Loading chains...</option>}
                {!chainsLoading && chains.length === 0 && <option value="">No chains available</option>}
                {chains.map((chain) => (
                  <option key={chain.value} value={chain.value}>
                    {chain.label} {chain.symbol ? `(${chain.symbol})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-white/50 tracking-tight">Token</label>
              <select
                value={fromTokenSymbol}
                onChange={(event) => {
                  setFromTokenSymbol(event.target.value)
                  setRelayQuote(null)
                  setRelayQuoteError(null)
                  setOrderResponse(null)
                }}
                disabled={fromTokensLoading || fromTokens.length === 0}
                className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 bg-white/[0.04] text-white disabled:opacity-50"
              >
                {fromTokensLoading && <option value="">Loading tokens...</option>}
                {!fromTokensLoading && fromTokens.length === 0 && <option value="">No tokens</option>}
                {fromTokens.map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol} {token.name && token.name !== token.symbol ? `• ${token.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-white/50 tracking-tight">Amount</label>
              <input
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value)
                  setRelayQuote(null)
                  setRelayQuoteError(null)
                  setOrderResponse(null)
                }}
                placeholder="0.00"
                className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 bg-white/[0.04] text-white placeholder:text-white/30"
              />
            </div>
          </div>

          <div className="hidden md:flex items-center justify-center">
            <button
              onClick={handleSwapDirection}
              className="w-12 h-12 rounded-2xl bg-primary-500/10 border border-primary-500/40 flex items-center justify-center text-primary-300 hover:bg-primary-500/20 transition"
            >
              <ArrowLeftRight className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/70 tracking-tight">You Receive</span>
              <span className="text-xs uppercase text-white/30 tracking-[0.2em]">TO</span>
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-white/50 tracking-tight">Chain</label>
              <select
                value={toChainValue}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setToChainValue(nextValue)
                  setRelayQuote(null)
                  setRelayQuoteError(null)
                  setOrderResponse(null)
                }}
                className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 bg-white/[0.04] text-white"
              >
                {chainsLoading && <option value="">Loading chains...</option>}
                {!chainsLoading && chains.length === 0 && <option value="">No chains available</option>}
                {chains.map((chain) => (
                  <option key={chain.value} value={chain.value}>
                    {chain.label} {chain.symbol ? `(${chain.symbol})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-white/50 tracking-tight">Token</label>
              <select
                value={toTokenSymbol}
                onChange={(event) => {
                  setToTokenSymbol(event.target.value)
                  setRelayQuote(null)
                  setRelayQuoteError(null)
                  setOrderResponse(null)
                }}
                disabled={toTokensLoading || toTokens.length === 0}
                className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 bg-white/[0.04] text-white disabled:opacity-50"
              >
                {toTokensLoading && <option value="">Loading tokens...</option>}
                {!toTokensLoading && toTokens.length === 0 && <option value="">No tokens</option>}
                {toTokens.map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol} {token.name && token.name !== token.symbol ? `• ${token.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-white/50 tracking-tight">Recipient Address</label>
              <input
                value={recipientAddress}
                onChange={(event) => setRecipientAddress(event.target.value)}
                placeholder="Wallet address to receive swapped funds"
                className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 bg-white/[0.04] text-white placeholder:text-white/30"
              />
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-white/40 tracking-tight">Refund Address (optional)</label>
              <input
                value={refundAddress}
                onChange={(event) => setRefundAddress(event.target.value)}
                placeholder="Fallback address if swap fails"
                className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 bg-white/[0.04] text-white placeholder:text-white/30"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 md:hidden">
          <button
            onClick={handleSwapDirection}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 glass-strong rounded-xl border border-white/10 text-white hover:border-primary-500/40 transition"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Swap Direction
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass rounded-3xl border border-white/[0.08] p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Live Quote</h2>
            <p className="text-sm text-white/50 tracking-tight">
              Quotes refresh automatically while you type. Swap pairs and liquidity come straight from Relay.
            </p>
          </div>
          <div className="text-right text-sm text-white/40 tracking-tight">
            {relayQuote?.fetchedAt ? (
              <span>
                Updated {new Date(relayQuote.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            ) : relayQuoting ? (
              <span>Fetching quote...</span>
            ) : (
              <span>Waiting for quote...</span>
            )}
          </div>
        </div>

        {relayQuoteError && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3 text-sm text-red-200">
            <AlertTriangle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-medium tracking-tight">Quote unavailable</p>
              <p className="mt-1 text-red-100/80 tracking-tight">{relayQuoteError}</p>
            </div>
          </div>
        )}

        {!relayQuoteError && relayQuoting && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3 text-sm text-white/70">
            <Loader2 className="w-5 h-5 animate-spin" />
            Fetching best price across Relay routes...
          </div>
        )}

        {!relayQuoteError && relayQuote && !relayQuoting && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="glass-strong rounded-2xl border border-white/10 p-5">
              <p className="text-sm text-white/40 tracking-tight mb-2">You send</p>
              <p className="text-2xl font-semibold text-white tracking-tight">
                {formatAmount(relayQuote.fromAmount)} {relayFromToken?.symbol || fromTokenSymbol || 'TOKEN'}
              </p>
              <p className="text-xs text-white/30 tracking-tight mt-2">Minimum: {relayQuote.minAmount != null ? formatAmount(relayQuote.minAmount) : '—'}</p>
            </div>
            <div className="glass-strong rounded-2xl border border-white/10 p-5">
              <p className="text-sm text-white/40 tracking-tight mb-2">Estimated receive</p>
              <p className="text-2xl font-semibold text-white tracking-tight">
                {formatAmount(relayQuote.estimatedToAmount)} {relayToToken?.symbol || toTokenSymbol || 'TOKEN'}
              </p>
              <p className="text-xs text-white/30 tracking-tight mt-2">Maximum: {relayQuote.maxAmount != null ? formatAmount(relayQuote.maxAmount) : '—'}</p>
            </div>
            <div className="glass-strong rounded-2xl border border-white/10 p-5 flex flex-col justify-between">
              <div>
                <p className="text-sm text-white/40 tracking-tight mb-2">Rate</p>
                <p className="text-2xl font-semibold text-white tracking-tight">
                  {computedRate ? `1 ${relayFromToken?.symbol || fromTokenSymbol || 'TOKEN'} ≈ ${formatAmount(computedRate)} ${relayToToken?.symbol || toTokenSymbol || 'TOKEN'}` : '—'}
                </p>
              </div>
              <p className="text-xs text-white/30 tracking-tight mt-4 flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Powered by Relay liquidity
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
          <div className="text-xs text-white/40 tracking-tight">
            Quotes can change quickly. Always confirm the send amount and deposit address right before you transfer funds.
          </div>
          <button
            onClick={handleCreateOrder}
            disabled={!canQuote || orderLoading || relayQuoting}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary-500/20 border border-primary-500/40 text-primary-100 hover:bg-primary-500/30 transition disabled:opacity-50"
          >
            {orderLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            Create Swap Order
          </button>
        </div>
      </motion.div>

      {orderResponse && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-3xl border border-white/[0.08] p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold text-white tracking-tight">Swap Instructions</h2>
              <p className="text-sm text-white/50 tracking-tight">Send funds exactly as shown below to execute the swap.</p>
            </div>
            <div className="text-xs text-white/40 tracking-tight">
              Exchange ID:&nbsp;
              <span className="font-mono text-white/60">
                {orderResponse.exchangeId || orderResponse.id || orderResponse.orderId || 'Unknown'}
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(orderResponse.depositAddress || orderResponse.originAddress) && (
              <div className="glass-strong rounded-2xl border border-white/10 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/40 tracking-tight">Deposit address</p>
                  <button
                    onClick={() => handleCopy(orderResponse.depositAddress || orderResponse.originAddress, 'Deposit address')}
                    className="inline-flex items-center gap-1 text-xs text-primary-200 hover:text-primary-100"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
                <div className="font-mono text-sm text-white/80 break-all">
                  {orderResponse.depositAddress || orderResponse.originAddress}
                </div>
              </div>
            )}

            {(orderResponse.amount || orderResponse.fromAmount || orderResponse.originAmount) && (
              <div className="glass-strong rounded-2xl border border-white/10 p-5 space-y-2">
                <p className="text-sm text-white/40 tracking-tight">Send this amount</p>
                <p className="text-lg font-semibold text-white tracking-tight">
                  {formatAmount(orderResponse.amount || orderResponse.fromAmount || orderResponse.originAmount)} {relayFromToken?.symbol || fromTokenSymbol || 'TOKEN'}
                </p>
              </div>
            )}

            {(orderResponse.destinationAmount || orderResponse.toAmount || orderResponse.estimatedAmount) && (
              <div className="glass-strong rounded-2xl border border-white/10 p-5 space-y-2">
                <p className="text-sm text-white/40 tracking-tight">Estimated receive</p>
                <p className="text-lg font-semibold text-white tracking-tight">
                  {formatAmount(orderResponse.destinationAmount || orderResponse.toAmount || orderResponse.estimatedAmount)} {relayToToken?.symbol || toTokenSymbol || 'TOKEN'}
                </p>
              </div>
            )}

            {orderResponse.validUntil && (
              <div className="glass-strong rounded-2xl border border-white/10 p-5 space-y-2">
                <p className="text-sm text-white/40 tracking-tight">Quote expires</p>
                <p className="text-lg font-semibold text-white tracking-tight">
                  {new Date(orderResponse.validUntil).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {orderResponse.transactionUrl && (
            <a
              href={orderResponse.transactionUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary-200 hover:text-primary-100"
            >
              <ExternalLink className="w-4 h-4" /> View details on Relay
            </a>
          )}

          <div className="glass-strong rounded-2xl border border-white/10 p-5 text-xs text-white/40 tracking-tight">
            <p className="font-medium text-white/60">What next?</p>
            <ul className="mt-2 space-y-2 list-disc list-inside">
              <li>Send the funds from the wallet that matches your refund address (if provided).</li>
              <li>Only send the exact asset and chain you selected. Incorrect deposits will fail or be lost.</li>
              <li>Keep this page open — we will redirect you to live status once the deposit is detected.</li>
            </ul>
          </div>

          <details className="glass-strong rounded-2xl border border-white/10 p-4 text-xs text-white/40">
            <summary className="cursor-pointer text-white/70">Show raw response</summary>
            <pre className="mt-3 whitespace-pre-wrap break-all text-[11px] text-white/60">
{JSON.stringify(orderResponse, null, 2)}
            </pre>
          </details>
        </motion.div>
      )}
    </div>
  )
}

export default Swapper
