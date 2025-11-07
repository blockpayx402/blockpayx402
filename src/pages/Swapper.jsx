import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  ArrowLeftRight,
  RefreshCw,
  Loader2,
  Wallet,
  AlertTriangle,
  Copy,
  ExternalLink
} from 'lucide-react'
import { relayAPI, ordersAPI } from '../services/api'

const NUMBER_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 6,
  minimumFractionDigits: 0,
})

const formatAmount = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return value ?? '—'
  }

  if (numeric === 0) {
    return '0'
  }

  if (numeric >= 1) {
    return NUMBER_FORMATTER.format(numeric)
  }

  return numeric.toPrecision(4)
}

const getChainKey = (chain) => {
  if (!chain) return ''
  return (chain.chainId ?? chain.value ?? '').toString()
}

const pickDefaultToken = (tokens) => {
  if (!tokens || tokens.length === 0) return ''
  const preferred = tokens.find((token) => token.isNative)
  return (preferred ?? tokens[0]).symbol ?? ''
}

const Swapper = () => {
  const [chains, setChains] = useState([])
  const [chainsLoading, setChainsLoading] = useState(true)
  const [tokenCache, setTokenCache] = useState({})

  const [fromChainValue, setFromChainValue] = useState('')
  const [toChainValue, setToChainValue] = useState('')

  const [fromTokens, setFromTokens] = useState([])
  const [toTokens, setToTokens] = useState([])
  const [fromTokensLoading, setFromTokensLoading] = useState(false)
  const [toTokensLoading, setToTokensLoading] = useState(false)

  const [fromTokenSymbol, setFromTokenSymbol] = useState('')
  const [toTokenSymbol, setToTokenSymbol] = useState('')

  const [amount, setAmount] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [refundAddress, setRefundAddress] = useState('')

  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState(null)
  const [quoting, setQuoting] = useState(false)

  const [orderResponse, setOrderResponse] = useState(null)
  const [orderLoading, setOrderLoading] = useState(false)

  const fromChain = useMemo(
    () => chains.find((chain) => chain.value?.toString() === fromChainValue.toString()) ?? null,
    [chains, fromChainValue]
  )

  const toChain = useMemo(
    () => chains.find((chain) => chain.value?.toString() === toChainValue.toString()) ?? null,
    [chains, toChainValue]
  )

  const fromToken = useMemo(
    () => fromTokens.find((token) => token.symbol === fromTokenSymbol) ?? null,
    [fromTokens, fromTokenSymbol]
  )

  const toToken = useMemo(
    () => toTokens.find((token) => token.symbol === toTokenSymbol) ?? null,
    [toTokens, toTokenSymbol]
  )

  const parsedAmount = useMemo(() => {
    const value = parseFloat(amount)
    return Number.isFinite(value) && value > 0 ? value : null
  }, [amount])

  const canQuote = Boolean(fromChain && toChain && fromToken && toToken && parsedAmount)

  useEffect(() => {
    let mounted = true

    const fetchChains = async () => {
      setChainsLoading(true)
      try {
        const fetchedChains = await relayAPI.getChains()
        if (!mounted) return

        const usableChains = (fetchedChains || [])
          .filter((chain) => chain?.value && chain?.label)
          .sort((a, b) => a.label.localeCompare(b.label))

        setChains(usableChains)

        if (usableChains.length > 0) {
          const defaultFrom = usableChains.find((chain) => (chain.symbol ?? '').toUpperCase() === 'ETH') ?? usableChains[0]
          const defaultTo = usableChains.find((chain) => chain.value !== defaultFrom.value) ?? usableChains[usableChains.length > 1 ? 1 : 0]

          setFromChainValue(defaultFrom.value.toString())
          setToChainValue(defaultTo?.value?.toString() ?? defaultFrom.value.toString())
        }
      } catch (error) {
        if (mounted) {
          console.error('Failed to load chains', error)
          toast.error('Failed to load chains from Relay. Please try again later.')
          setChains([])
        }
      } finally {
        if (mounted) {
          setChainsLoading(false)
        }
      }
    }

    fetchChains()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadTokens = async (selectedChain, setTokens, setTokenSymbol) => {
      if (!selectedChain) {
        setTokens([])
        setTokenSymbol('')
        return
      }

      const chainKey = getChainKey(selectedChain)
      if (!chainKey) {
        setTokens([])
        setTokenSymbol('')
        return
      }

      const cachedTokens = tokenCache[chainKey]
      if (cachedTokens) {
        setTokens(cachedTokens)
        setTokenSymbol((current) => {
          if (current && cachedTokens.some((token) => token.symbol === current)) {
            return current
          }
          return pickDefaultToken(cachedTokens)
        })
        return
      }

      const setLoading = selectedChain === fromChain ? setFromTokensLoading : setToTokensLoading
      setLoading(true)

      try {
        const fetchedTokens = await relayAPI.getTokens(chainKey)
        if (!active) return

        const filteredTokens = (fetchedTokens || [])
          .filter((token) => token?.symbol)
          .sort((a, b) => a.symbol.localeCompare(b.symbol))

        setTokenCache((prev) => ({
          ...prev,
          [chainKey]: filteredTokens,
        }))

        setTokens(filteredTokens)
        setTokenSymbol((current) => {
          if (current && filteredTokens.some((token) => token.symbol === current)) {
            return current
          }
          return pickDefaultToken(filteredTokens)
        })
      } catch (error) {
        if (!active) return
        console.error('Failed to load tokens', error)
        toast.error(`Failed to load tokens for ${selectedChain.label}.`)
        setTokens([])
        setTokenSymbol('')
      } finally {
        if (active) {
          const updateLoading = selectedChain === fromChain ? setFromTokensLoading : setToTokensLoading
          updateLoading(false)
        }
      }
    }

    loadTokens(fromChain, setFromTokens, setFromTokenSymbol)
    loadTokens(toChain, setToTokens, setToTokenSymbol)

    return () => {
      active = false
    }
  }, [fromChain, toChain, tokenCache])

  const fetchQuote = useCallback(
    async ({ silent = false } = {}) => {
      if (!fromChain || !toChain || !fromToken || !toToken) {
        setQuote(null)
        setQuoteError(null)
        return
      }

      const amountValue = parseFloat(amount)
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setQuote(null)
        setQuoteError(null)
        return
      }

      setQuoting(true)
      setQuoteError(null)

      try {
        const response = await ordersAPI.getExchangeRate({
          fromChain: getChainKey(fromChain),
          fromAsset: fromToken.symbol,
          toChain: getChainKey(toChain),
          toAsset: toToken.symbol,
          amount: amountValue,
          direction: 'forward',
        })

        setQuote({
          ...response,
          fetchedAt: Date.now(),
        })
      } catch (error) {
        const message = error.message || 'Failed to fetch quote'
        setQuote(null)
        setQuoteError(message)
        if (!silent) {
          toast.error(message)
        }
      } finally {
        setQuoting(false)
      }
    },
    [amount, fromChain, fromToken, toChain, toToken]
  )

  useEffect(() => {
    if (!canQuote) {
      setQuote(null)
      setQuoteError(null)
      return
    }

    const debounce = setTimeout(() => {
      fetchQuote({ silent: true })
    }, 700)

    return () => clearTimeout(debounce)
  }, [canQuote, fetchQuote])

  const handleSwapDirection = () => {
    if (!fromChain || !toChain) return

    setFromChainValue(toChain.value.toString())
    setToChainValue(fromChain.value.toString())
    setFromTokenSymbol(toTokenSymbol)
    setToTokenSymbol(fromTokenSymbol)
    setQuote(null)
    setQuoteError(null)
    setOrderResponse(null)
  }

  const handleCreateOrder = async () => {
    if (!fromChain || !toChain || !fromToken || !toToken) {
      toast.error('Select both chains and tokens before creating a swap.')
      return
    }

    const amountValue = parseFloat(amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error('Enter a valid amount to swap.')
      return
    }

    if (!recipientAddress.trim()) {
      toast.error('Recipient address is required to receive the swapped funds.')
      return
    }

    setOrderLoading(true)

    try {
      const payload = {
        fromChain: getChainKey(fromChain),
        fromAsset: fromToken.symbol,
        toChain: getChainKey(toChain),
        toAsset: toToken.symbol,
        amount: amountValue,
        recipientAddress: recipientAddress.trim(),
        refundAddress: refundAddress.trim() || null,
        requestId: null,
      }

      const response = await ordersAPI.create(payload)
      setOrderResponse(response)
      toast.success('Swap order created. Follow the instructions below to complete it.')
    } catch (error) {
      console.error('Failed to create order', error)
      toast.error(error.message || 'Failed to create swap order')
    } finally {
      setOrderLoading(false)
    }
  }

  const handleCopy = async (value, label = 'Value') => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied to clipboard`)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const computedRate = useMemo(() => {
    if (!quote || !quote.estimatedToAmount || !quote.fromAmount) return null
    const output = Number(quote.estimatedToAmount)
    const input = Number(quote.fromAmount)
    if (!Number.isFinite(output) || !Number.isFinite(input) || input === 0) return null
    return output / input
  }, [quote])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-4xl font-semibold gradient-text tracking-tight">Cross-Chain Swapper</h1>
          <p className="text-white/60 text-base tracking-tight">
            Live quotes powered by Relay. Pick a pair, enter an amount, and get a real swap quote instantly.
          </p>
        </div>
        <button
          onClick={() => fetchQuote()}
          disabled={!canQuote || quoting}
          className="inline-flex items-center gap-2 px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/40 transition-all disabled:opacity-50"
        >
          {quoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh Price
        </button>
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
                  setFromChainValue(event.target.value)
                  setQuote(null)
                  setQuoteError(null)
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
                  setQuote(null)
                  setQuoteError(null)
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
                  setToChainValue(event.target.value)
                  setQuote(null)
                  setQuoteError(null)
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
                  setQuote(null)
                  setQuoteError(null)
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
            {quote?.fetchedAt ? (
              <span>
                Updated {new Date(quote.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            ) : (
              <span>Waiting for quote...</span>
            )}
          </div>
        </div>

        {quoteError && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3 text-sm text-red-200">
            <AlertTriangle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-medium tracking-tight">Quote unavailable</p>
              <p className="mt-1 text-red-100/80 tracking-tight">{quoteError}</p>
            </div>
          </div>
        )}

        {!quoteError && quoting && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3 text-sm text-white/70">
            <Loader2 className="w-5 h-5 animate-spin" />
            Fetching best price across Relay routes...
          </div>
        )}

        {!quoteError && quote && !quoting && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="glass-strong rounded-2xl border border-white/10 p-5">
              <p className="text-sm text-white/40 tracking-tight mb-2">You send</p>
              <p className="text-2xl font-semibold text-white tracking-tight">
                {formatAmount(quote.fromAmount)} {fromToken?.symbol}
              </p>
              <p className="text-xs text-white/30 tracking-tight mt-2">Minimum: {quote.minAmount ? formatAmount(quote.minAmount) : '—'}</p>
            </div>
            <div className="glass-strong rounded-2xl border border-white/10 p-5">
              <p className="text-sm text-white/40 tracking-tight mb-2">Estimated receive</p>
              <p className="text-2xl font-semibold text-white tracking-tight">
                {formatAmount(quote.estimatedToAmount)} {toToken?.symbol}
              </p>
              <p className="text-xs text-white/30 tracking-tight mt-2">Maximum: {quote.maxAmount ? formatAmount(quote.maxAmount) : '—'}</p>
            </div>
            <div className="glass-strong rounded-2xl border border-white/10 p-5 flex flex-col justify-between">
              <div>
                <p className="text-sm text-white/40 tracking-tight mb-2">Rate</p>
                <p className="text-2xl font-semibold text-white tracking-tight">
                  {computedRate ? `1 ${fromToken?.symbol} ≈ ${formatAmount(computedRate)} ${toToken?.symbol}` : '—'}
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
            disabled={!canQuote || orderLoading || quoting}
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
                  {formatAmount(orderResponse.amount || orderResponse.fromAmount || orderResponse.originAmount)} {fromToken?.symbol}
                </p>
              </div>
            )}

            {(orderResponse.destinationAmount || orderResponse.toAmount || orderResponse.estimatedAmount) && (
              <div className="glass-strong rounded-2xl border border-white/10 p-5 space-y-2">
                <p className="text-sm text-white/40 tracking-tight">Estimated receive</p>
                <p className="text-lg font-semibold text-white tracking-tight">
                  {formatAmount(orderResponse.destinationAmount || orderResponse.toAmount || orderResponse.estimatedAmount)} {toToken?.symbol}
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

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeftRight, RefreshCw, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'react-hot-toast'

const DEFAULT_TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xKmS4MJSaDvsks'
}

const Swapper = () => {
  const [tokens, setTokens] = useState([])
  const [tokensLoading, setTokensLoading] = useState(true)
  const [tokensError, setTokensError] = useState(null)

  const [fromMint, setFromMint] = useState(DEFAULT_TOKENS.SOL)
  const [toMint, setToMint] = useState(DEFAULT_TOKENS.USDC)
  const [amount, setAmount] = useState('1')

  const [quote, setQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState(null)

  const [isExactIn, setIsExactIn] = useState(true)

  useEffect(() => {
    const fetchTokens = async () => {
      setTokensLoading(true)
      setTokensError(null)
      try {
        const response = await fetch('https://tokens.jup.ag/tokens?tags=verified,community,strict')
        if (!response.ok) {
          throw new Error(`Failed to fetch tokens (${response.status})`)
        }
        const data = await response.json()
        setTokens(data)
      } catch (error) {
        console.error('Error fetching tokens:', error)
        setTokensError('Unable to load token list. Using default assets.')
        toast.error('Unable to load token list. Showing defaults.')
        setTokens([
          {
            address: DEFAULT_TOKENS.SOL,
            symbol: 'SOL',
            name: 'Solana',
            decimals: 9,
            logoURI: 'https://assets.jup.ag/solana.svg'
          },
          {
            address: DEFAULT_TOKENS.USDC,
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            logoURI: 'https://assets.jup.ag/usdc.svg'
          },
          {
            address: DEFAULT_TOKENS.USDT,
            symbol: 'USDT',
            name: 'Tether',
            decimals: 6,
            logoURI: 'https://assets.jup.ag/usdt.svg'
          },
          {
            address: DEFAULT_TOKENS.BONK,
            symbol: 'BONK',
            name: 'Bonk',
            decimals: 5,
            logoURI: 'https://assets.jup.ag/bonk.svg'
          }
        ])
      } finally {
        setTokensLoading(false)
      }
    }

    fetchTokens()
  }, [])

  const fromToken = useMemo(
    () => tokens.find(token => token.address === fromMint),
    [tokens, fromMint]
  )

  const toToken = useMemo(
    () => tokens.find(token => token.address === toMint),
    [tokens, toMint]
  )

  const amountInBaseUnits = useMemo(() => {
    const token = fromToken
    if (!token) return null

    const decimalAmount = Number(amount)
    if (!Number.isFinite(decimalAmount) || decimalAmount <= 0) return null

    const factor = Math.pow(10, token.decimals || 0)
    return Math.floor(decimalAmount * factor)
  }, [fromToken, amount])

  useEffect(() => {
    const fetchQuote = async () => {
      if (!fromToken || !toToken || !amountInBaseUnits) {
        setQuote(null)
        return
      }

      if (fromToken.address === toToken.address) {
        setQuote(null)
        setQuoteError('Select two different tokens')
        return
      }

      setQuoteLoading(true)
      setQuoteError(null)

      const params = new URLSearchParams({
        inputMint: fromToken.address,
        outputMint: toToken.address,
        amount: String(amountInBaseUnits),
        slippageBps: '50'
      })

      try {
        const response = await fetch(`https://quote-api.jup.ag/v6/quote?${params}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch quote (${response.status})`)
        }
        const data = await response.json()
        setQuote(data)
      } catch (error) {
        console.error('Error fetching quote:', error)
        setQuoteError('Unable to fetch quote. Try a different amount or tokens.')
        setQuote(null)
      } finally {
        setQuoteLoading(false)
      }
    }

    fetchQuote()
  }, [amountInBaseUnits, fromToken, toToken])

  const priceSummary = useMemo(() => {
    if (!quote || !fromToken || !toToken) return null

    const outAmount = Number(quote.outAmount) / Math.pow(10, toToken.decimals)
    const inAmount = Number(amount)
    if (!Number.isFinite(outAmount) || !Number.isFinite(inAmount)) return null

    const rate = outAmount / inAmount
    const reverseRate = inAmount / outAmount

    return {
      outAmount,
      rate,
      reverseRate,
      priceImpactPct: quote.priceImpactPct ? quote.priceImpactPct * 100 : null,
      minOutAmount: quote.otherAmountThreshold
        ? Number(quote.otherAmountThreshold) / Math.pow(10, toToken.decimals)
        : null,
      jupiterLink: `https://jup.ag/swap/${fromToken.symbol}-${toToken.symbol}?inputMint=${fromToken.address}&outputMint=${toToken.address}`
    }
  }, [quote, fromToken, toToken, amount])

  const flipTokens = () => {
    setFromMint(toMint)
    setToMint(fromMint)
    setQuote(null)
  }

  const topTokens = useMemo(() => {
    if (!tokens.length) return []
    const importantAddresses = new Set(Object.values(DEFAULT_TOKENS))
    const preferred = tokens.filter(token => importantAddresses.has(token.address))
    if (preferred.length > 0) return preferred
    return tokens.slice(0, 20)
  }, [tokens])

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-8 border border-white/[0.08]"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">Swap Assets</h1>
            <p className="text-white/60 tracking-tight">Live quotes powered by Jupiter Aggregator</p>
          </div>
          <button
            onClick={flipTokens}
            className="p-3 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all"
          >
            <ArrowLeftRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TokenSelector
            label="From"
            value={fromMint}
            onChange={setFromMint}
            amount={amount}
            onAmountChange={setAmount}
            loading={tokensLoading}
            error={tokensError}
            tokens={tokens}
            topTokens={topTokens}
            token={fromToken}
          />
          <TokenSelector
            label="To"
            value={toMint}
            onChange={setToMint}
            loading={tokensLoading}
            error={tokensError}
            tokens={tokens}
            topTokens={topTokens}
            token={toToken}
            disableAmount
          />
        </div>

        <QuoteSummary
          quote={quote}
          fromToken={fromToken}
          toToken={toToken}
          amount={amount}
          priceSummary={priceSummary}
          loading={quoteLoading}
          error={quoteError}
        />
      </motion.div>
    </div>
  )
}

const TokenSelector = ({
  label,
  value,
  onChange,
  amount,
  onAmountChange,
  loading,
  error,
  tokens,
  topTokens,
  token,
  disableAmount
}) => {
  return (
    <div className="glass rounded-2xl p-6 border border-white/[0.08]">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white/60 text-sm tracking-tight">{label}</p>
        {disableAmount ? null : (
          <div className="text-right">
            <label className="text-xs text-white/40 tracking-tight mb-1 block">Amount</label>
            <input
              type="number"
              min="0"
              step="0.0000001"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-32 px-3 py-2 glass-strong rounded-lg border border-white/10 focus:border-primary-500/40 focus:outline-none text-right"
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 bg-white/[0.04] text-white focus:border-primary-500/40 focus:outline-none"
        >
          {loading ? (
            <option>Loading tokens…</option>
          ) : (
            <>
              {topTokens.map(token => (
                <option key={token.address} value={token.address}>
                  {token.symbol} — {token.name}
                </option>
              ))}
            </>
          )}
        </select>

        {token && (
          <div className="text-xs text-white/60 tracking-tight">
            <p>{token.name}</p>
            <p>Decimals: {token.decimals}</p>
            <p className="truncate">Mint: {token.address}</p>
          </div>
        )}

        {error && (
          <p className="text-xs text-yellow-400 tracking-tight">{error}</p>
        )}
      </div>
    </div>
  )
}

const QuoteSummary = ({ quote, fromToken, toToken, amount, priceSummary, loading, error }) => {
  if (loading) {
    return (
      <div className="glass rounded-2xl p-6 border border-white/[0.08] flex items-center gap-3 text-white/60">
        <Loader2 className="w-5 h-5 animate-spin" />
        Fetching quote…
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-6 border border-white/[0.08] text-yellow-400 text-sm tracking-tight">
        {error}
      </div>
    )
  }

  if (!quote || !priceSummary || !fromToken || !toToken) {
    return (
      <div className="glass rounded-2xl p-6 border border-white/[0.08] text-white/50 text-sm tracking-tight">
        Enter an amount to fetch a live quote.
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-6 border border-white/[0.08] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/60 text-sm tracking-tight">Estimated Output</p>
          <p className="text-2xl font-semibold text-white tracking-tight">
            {priceSummary.outAmount.toFixed(Math.min(6, toToken.decimals))} {toToken.symbol}
          </p>
        </div>
        <div className="text-right">
          <p className="text-white/60 text-sm tracking-tight">Rate</p>
          <p className="text-lg text-white tracking-tight">1 {fromToken.symbol} ≈ {priceSummary.rate.toFixed(6)} {toToken.symbol}</p>
          <p className="text-xs text-white/40 tracking-tight">1 {toToken.symbol} ≈ {priceSummary.reverseRate.toFixed(6)} {fromToken.symbol}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-white/60">
        <div className="glass-strong rounded-xl p-4 border border-white/10">
          <p className="text-white/40 text-xs tracking-tight mb-1">Price Impact</p>
          <p className="text-white tracking-tight">
            {priceSummary.priceImpactPct !== null
              ? `${priceSummary.priceImpactPct.toFixed(2)}%`
              : 'N/A'}
          </p>
        </div>
        <div className="glass-strong rounded-xl p-4 border border-white/10">
          <p className="text-white/40 text-xs tracking-tight mb-1">Minimum Received (50 bps)</p>
          <p className="text-white tracking-tight">
            {priceSummary.minOutAmount !== null
              ? `${priceSummary.minOutAmount.toFixed(Math.min(6, toToken.decimals))} ${toToken.symbol}`
              : 'N/A'}
          </p>
        </div>
        <div className="glass-strong rounded-xl p-4 border border-white/10">
          <p className="text-white/40 text-xs tracking-tight mb-1">Route</p>
          <p className="text-white tracking-tight truncate">
            {quote.routePlan && quote.routePlan.length > 0
              ? quote.routePlan.map(r => r.swapInfo.label || r.swapInfo.programId).join(' → ')
              : 'Direct'}
          </p>
        </div>
      </div>

      <div className="glass-strong rounded-xl p-4 border border-white/10 text-xs text-white/40 tracking-tight">
        <p>Quotes provided by <a href="https://station.jup.ag" target="_blank" rel="noreferrer" className="text-primary-400 hover:text-primary-300">Jupiter Aggregator</a>. Values update automatically as you change amount or tokens.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={priceSummary.jupiterLink}
          target="_blank"
          rel="noreferrer"
          className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white font-medium shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 transition-all flex items-center justify-center gap-2"
        >
          Open in Jupiter
          <ExternalLink className="w-4 h-4" />
        </a>
        <button
          onClick={() => navigator.clipboard.writeText(JSON.stringify({
            inputMint: fromToken.address,
            outputMint: toToken.address,
            amount
          }, null, 2))}
          className="px-4 py-3 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all text-white/80 hover:text-white text-sm"
        >
          Copy quote params
        </button>
      </div>
    </div>
  )
}

export default Swapper

