import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { Loader2, ArrowLeftRight, ExternalLink, Search } from 'lucide-react'

const isMaybeMint = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s || '')

const TokenSelector = ({ label, tokens, value, onChange }) => {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tokens.slice(0, 250)
    return tokens.filter(t => (
      t.symbol?.toLowerCase().includes(q) ||
      t.name?.toLowerCase().includes(q) ||
      t.address?.toLowerCase() === q
    )).slice(0, 250)
  }, [query, tokens])

  return (
    <div className="space-y-2">
      <label className="block text-sm text-white/50 tracking-tight">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
          placeholder="Search by symbol, name, or paste mint address"
          className="w-full pl-10 pr-28 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 bg-white/[0.04] text-white placeholder:text-white/30"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
          <button onClick={()=>setQuery('')} className="px-3 py-1 text-xs glass-strong rounded-lg border border-white/10 text-white/60 hover:text-white">Clear</button>
          <button onClick={()=>{
            const q = query.trim()
            if (!isMaybeMint(q)) { toast.error('Enter a valid token mint'); return }
            onChange(q)
          }} className="px-3 py-1 text-xs bg-primary-500/20 border border-primary-500/40 text-primary-100 rounded-lg hover:bg-primary-500/30">Use Mint</button>
        </div>
      </div>
      <div className="max-h-56 overflow-auto glass rounded-xl border border-white/10">
        {filtered.map(tok => (
          <button key={tok.address} onClick={()=>onChange(tok.address)} className={`w-full text-left px-4 py-2 border-b border-white/5 hover:bg-white/[0.04] ${value===tok.address?'bg-primary-500/10':''}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white tracking-tight font-medium">{tok.symbol} <span className="text-white/40 font-normal">— {tok.name}</span></div>
                <div className="text-xs text-white/40 font-mono">{tok.address}</div>
              </div>
              <div className="text-xs text-white/40">decimals: {tok.decimals ?? '—'}</div>
            </div>
          </button>
        ))}
        {filtered.length===0 && <div className="px-4 py-6 text-sm text-white/40">No results. Paste a mint and click Use Mint.</div>}
      </div>
    </div>
  )
}

const Swapper = () => {
  const [tokens, setTokens] = useState([])
  const [loadingTokens, setLoadingTokens] = useState(true)
  const [fromMint, setFromMint] = useState('')
  const [toMint, setToMint] = useState('')
  const [amount, setAmount] = useState('1')
  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoadingTokens(true)
      try {
        const res = await fetch('https://tokens.jup.ag/tokens?tags=verified,community,strict')
        const data = await res.json()
        setTokens(Array.isArray(data)?data:[])
        const usdc = data.find(t=>t.symbol==='USDC')
        const sol = data.find(t=>t.symbol==='SOL')
        setFromMint(usdc?.address || data[0]?.address || '')
        setToMint(sol?.address || data[1]?.address || '')
      } catch(e) {
        toast.error('Unable to load token list. Paste a mint to proceed.')
        setTokens([])
      } finally { setLoadingTokens(false) }
    }
    load()
  }, [])

  const fromToken = useMemo(()=>tokens.find(t=>t.address===fromMint),[tokens,fromMint])
  const toToken = useMemo(()=>tokens.find(t=>t.address===toMint),[tokens,toMint])
  const amountInBaseUnits = useMemo(()=>{
    const dec = fromToken?.decimals ?? 9
    const num = Number(amount)
    if (!Number.isFinite(num) || num<=0) return null
    return Math.floor(num * Math.pow(10, dec))
  },[amount, fromToken])

  const fetchQuote = async () => {
    setError(null)
    setQuote(null)
    if (!isMaybeMint(fromMint) || !isMaybeMint(toMint)) { setError('Select valid token mints'); return }
    if (!amountInBaseUnits) { setError('Enter a valid amount'); return }
    setQuoting(true)
    try {
      const params = new URLSearchParams({ inputMint: fromMint, outputMint: toMint, amount: String(amountInBaseUnits), slippageBps: '50' })
      const res = await fetch(`https://quote-api.jup.ag/v6/quote?${params}`)
      if (!res.ok) throw new Error('Quote failed')
      const data = await res.json()
      setQuote(data?.data?.[0] || data)
    } catch(e) {
      setError('Unable to fetch quote for this pair')
    } finally { setQuoting(false) }
  }

  const jupiterLink = useMemo(()=>{
    if (!isMaybeMint(fromMint) || !isMaybeMint(toMint)) return '#'
    return `https://jup.ag/swap/${fromMint}-${toMint}`
  },[fromMint,toMint])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-semibold gradient-text tracking-tight">Swap Assets</h1>
          <p className="text-white/60 text-sm tracking-tight">Live quotes powered by Jupiter Aggregator</p>
        </div>
        <button onClick={fetchQuote} disabled={quoting} className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/40 transition disabled:opacity-50">
          {quoting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Get Quote'}
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
