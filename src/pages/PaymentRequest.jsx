import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Copy, Check, Sparkles, Loader2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import QRCode from 'qrcode.react'
import { useApp } from '../context/AppContext'
import { usePaymentRequest } from '../hooks/usePaymentRequest'

const PaymentRequest = () => {
  const navigate = useNavigate()
  const { createRequest, loading } = usePaymentRequest()
  const [formData, setFormData] = useState({
    amount: '',
    chain: 'ethereum',
    currency: 'ETH', // Currency seller wants to receive
    description: '',
    recipient: '',
    enableExchange: true, // Enable automatic exchange via ChangeNOW
  })
  const [requestCreated, setRequestCreated] = useState(false)
  const [createdRequest, setCreatedRequest] = useState(null)

  const [availableCurrencies, setAvailableCurrencies] = useState(['ETH', 'USDT', 'USDC', 'DAI'])

  // Update currencies when chain changes
  useEffect(() => {
    const updateCurrencies = async () => {
      try {
        const { getChainCurrencies } = await import('../services/blockchain')
        const currencies = getChainCurrencies(formData.chain)
        if (currencies && currencies.length > 0) {
          setAvailableCurrencies(currencies)
          // Reset currency if not available in new chain
          if (!currencies.includes(formData.currency)) {
            setFormData(prev => ({ ...prev, currency: currencies[0] }))
          }
        }
      } catch (error) {
        console.error('Error updating currencies:', error)
        // Fallback currencies
        const fallback = formData.chain === 'solana' ? ['SOL'] : ['ETH', 'USDT', 'USDC']
        setAvailableCurrencies(fallback)
      }
    }
    updateCurrencies()
  }, [formData.chain])

  const handleSubmit = async (e) => {
    e.preventDefault()

    const request = await createRequest(formData)
    if (request) {
      setCreatedRequest(request)
      setRequestCreated(true)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const paymentUrl = createdRequest 
    ? `${window.location.origin}/pay/${createdRequest.id}`
    : ''

  if (requestCreated) {
    return (
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-dark-400 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="glass rounded-3xl p-10 border border-white/[0.08] text-center max-w-3xl mx-auto"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.6, delay: 0.2 }}
            className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-soft-lg shadow-green-500/30"
          >
            <Check className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-4xl font-semibold mb-3 gradient-text tracking-tight">Request Created!</h2>
          <p className="text-white/60 text-lg mb-10 tracking-tight">Share this link or QR code to receive payment</p>

          <div className="space-y-6">
            <div className="glass-strong rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-dark-400">Payment Request ID</span>
                <button
                  onClick={() => copyToClipboard(createdRequest.id)}
                  className="text-primary-400 hover:text-primary-300"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="font-mono text-sm break-all">{createdRequest.id}</p>
            </div>

            <div className="glass-strong rounded-2xl p-8 flex items-center justify-center border border-white/[0.12]">
              <div className="w-64 h-64 bg-white rounded-2xl p-4 flex items-center justify-center shadow-soft-lg">
                <QRCode 
                  value={paymentUrl} 
                  size={224}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>

            <div className="glass-strong rounded-2xl p-5 border border-white/[0.12]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white/60 tracking-tight">Payment Link</span>
                <button
                  onClick={() => copyToClipboard(paymentUrl)}
                  className="text-primary-400 hover:text-primary-300 flex items-center gap-2 transition-colors p-2 glass-strong rounded-lg border border-primary-500/30 hover:bg-primary-500/10"
                  title="Copy link"
                >
                  <Copy className="w-4 h-4" />
                  <span className="text-xs tracking-tight">Copy</span>
                </button>
              </div>
              <p className="font-mono text-xs break-all text-white/70 tracking-tight">{paymentUrl}</p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => copyToClipboard(paymentUrl)}
                className="flex-1 px-6 py-3 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all font-medium flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white font-medium shadow-lg shadow-primary-500/30"
              >
                View Dashboard
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-2 text-dark-400 hover:text-white mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="glass rounded-3xl p-10 border border-white/[0.08] max-w-3xl mx-auto"
      >
        <div className="flex items-center gap-4 mb-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-soft-lg shadow-primary-500/20">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">Create Payment Request</h1>
            <p className="text-white/60 text-lg">Generate a secure payment request link</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-3 text-white/80 tracking-tight">Blockchain Network</label>
            <select
              value={formData.chain}
              onChange={(e) => setFormData({ ...formData, chain: e.target.value })}
              className="w-full px-5 py-4 glass-strong rounded-2xl border border-white/[0.12] focus:border-white/[0.20] focus:outline-none transition-all bg-white/[0.04] text-white text-[15px] tracking-tight"
            >
              <option value="ethereum" className="bg-black text-white">Ethereum (ETH)</option>
              <option value="bnb" className="bg-black text-white">BNB Chain (BNB)</option>
              <option value="polygon" className="bg-black text-white">Polygon (MATIC)</option>
              <option value="solana" className="bg-black text-white">Solana (SOL)</option>
            </select>
            <p className="text-xs text-white/50 mt-2.5 tracking-tight">
              Select the blockchain network for this payment
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium mb-3 text-white/80 tracking-tight">Amount</label>
              <input
                type="number"
                step="0.000001"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-5 py-4 glass-strong rounded-2xl border border-white/[0.12] focus:border-white/[0.20] focus:outline-none transition-all bg-white/[0.04] text-white placeholder:text-white/30 text-[15px] tracking-tight"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-3 text-white/80 tracking-tight">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-5 py-4 glass-strong rounded-2xl border border-white/[0.12] focus:border-white/[0.20] focus:outline-none transition-all bg-white/[0.04] text-white text-[15px] tracking-tight"
              >
                {availableCurrencies.map((currency) => (
                  <option key={currency} value={currency} className="bg-black text-white">
                    {currency}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3 text-white/80 tracking-tight">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-5 py-4 glass-strong rounded-2xl border border-white/[0.12] focus:border-white/[0.20] focus:outline-none transition-all bg-white/[0.04] text-white placeholder:text-white/30 text-[15px] tracking-tight"
              placeholder="Payment for services"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-3 text-white/80 tracking-tight">Recipient Address</label>
            <input
              type="text"
              value={formData.recipient}
              onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
              className="w-full px-5 py-4 glass-strong rounded-2xl border border-white/[0.12] focus:border-white/[0.20] focus:outline-none transition-all bg-white/[0.04] text-white placeholder:text-white/30 font-mono text-sm tracking-tight"
              placeholder={formData.chain === 'solana' ? 'Enter Solana address...' : '0x...'}
              required
            />
            <p className="text-xs text-white/50 mt-2.5 tracking-tight">
              {formData.chain === 'solana' 
                ? 'Enter your Solana wallet address (e.g., 44kiGWWsSgdqPMvmqYgTS78Mx2BKCWzduATkfY4fnUta)'
                : 'Enter your wallet address where you want to receive payments'}
            </p>
          </div>

          <div className="glass-strong rounded-2xl p-5 border border-blue-500/30 bg-blue-500/10">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="enableExchange"
                checked={formData.enableExchange}
                onChange={(e) => setFormData({ ...formData, enableExchange: e.target.checked })}
                className="mt-1 w-5 h-5 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-500/50"
              />
              <div className="flex-1">
                <label htmlFor="enableExchange" className="block text-sm font-semibold text-blue-400 mb-2 tracking-tight cursor-pointer">
                  Enable Instant Cross-Chain Exchange
                </label>
                <p className="text-xs text-white/70 leading-relaxed tracking-tight">
                  Buyers can pay in any currency (BTC, BNB, ETH, etc.) and it will automatically exchange to {formData.currency} and send directly to your address. 
                  Powered by ChangeNOW for instant cross-chain payments.
                </p>
              </div>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={!loading ? { scale: 1.01 } : {}}
            whileTap={!loading ? { scale: 0.99 } : {}}
            transition={{ duration: 0.2 }}
            className="w-full px-6 py-4 bg-white text-black rounded-2xl text-sm font-semibold shadow-soft-lg hover:shadow-soft-lg hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 tracking-tight mt-8"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Payment Request'
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}

export default PaymentRequest

