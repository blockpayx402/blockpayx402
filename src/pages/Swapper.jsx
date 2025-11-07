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
