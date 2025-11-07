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

