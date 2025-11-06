import { motion } from 'framer-motion'
import { CheckCircle2, Clock, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { CHAINS } from '../services/blockchain'
import { useApp } from '../context/AppContext'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

const PaymentRequestCard = ({ request, onClick }) => {
  const { updatePaymentRequestStatus, addTransaction } = useApp()
  const [isVerifying, setIsVerifying] = useState(false)
  const isExpired = request.isExpired || (request.expiresAt && new Date(request.expiresAt) < new Date())
  const displayStatus = isExpired && request.status === 'pending' ? 'expired' : request.status
  
  const statusConfig = {
    completed: {
      icon: CheckCircle2,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      label: 'Completed'
    },
    pending: {
      icon: Clock,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20',
      label: 'Pending'
    },
    failed: {
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      label: 'Failed'
    },
    expired: {
      icon: AlertCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      label: 'Expired'
    }
  }

  const config = statusConfig[displayStatus] || statusConfig.pending
  const Icon = config.icon
  
  const getTimeRemaining = () => {
    if (!request.expiresAt || isExpired) return null
    const now = new Date()
    const expires = new Date(request.expiresAt)
    const diff = expires - now
    if (diff <= 0) return null
    
    const minutes = Math.floor(diff / 60000)
    return `${minutes} min`
  }
  
  const timeRemaining = getTimeRemaining()

  const handleManualVerify = async (e) => {
    e.stopPropagation()
    if (isVerifying || displayStatus !== 'pending') return
    
    setIsVerifying(true)
    toast.loading('Verifying payment...', { id: 'verify' })
    
    try {
      const { verifyPayment, CHAINS } = await import('../services/blockchain')
      const chain = request.chain || 'ethereum'
      const chainConfig = CHAINS[chain]
      const isNativeCurrency = chainConfig && request.currency === chainConfig.nativeCurrency
      
      const requestTimestamp = request.createdAt 
        ? new Date(request.createdAt).getTime() 
        : null
      
      console.log('🔍 Manual verification triggered:', {
        requestId: request.id,
        chain,
        recipient: request.recipient,
        amount: request.amount,
        currency: request.currency
      })
      
      const result = await verifyPayment(
        chain,
        request.recipient,
        request.amount,
        isNativeCurrency ? 'native' : request.currency,
        requestTimestamp
      )
      
      if (result?.verified && result.txHash) {
        console.log('✅ Payment verified manually!', result)
        
        // Update status
        await updatePaymentRequestStatus(request.id, 'completed')
        
        // Save transaction
        await addTransaction({
          requestId: request.id,
          amount: result.amount?.toString() || request.amount,
          currency: request.currency,
          from: result.from || 'Unknown',
          to: result.to || request.recipient,
          status: 'completed',
          description: request.description || 'Payment verified',
          chain: request.chain,
          txHash: result.txHash,
          timestamp: result.timestamp || result.blockTime || new Date().toISOString(),
        })
        
        toast.success(`✅ Payment verified! Status updated to completed.`, { id: 'verify' })
        
        // Refresh page after 1 second to show updated status
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        toast.error(`Payment not found yet. ${result?.reason || result?.error || 'Keep waiting...'}`, { id: 'verify' })
        console.log('❌ Payment not verified:', result)
      }
    } catch (error) {
      console.error('Error during manual verification:', error)
      toast.error(`Verification error: ${error.message}`, { id: 'verify' })
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <motion.div
      whileHover={{ scale: 1.01, borderColor: 'rgba(255, 255, 255, 0.16)' }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="glass rounded-2xl p-5 border border-white/[0.08] hover:border-white/[0.12] transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h3 className="text-xl font-semibold tracking-tight">{request.amount} {request.currency}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${config.bg} ${config.border} border ${config.color} tracking-tight`}>
              <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              {config.label}
              {timeRemaining && displayStatus === 'pending' && (
                <span className="ml-1.5 text-[10px] opacity-75">• {timeRemaining}</span>
              )}
            </span>
            {request.chain && CHAINS[request.chain] && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/[0.08] border border-white/[0.12] text-white/70 tracking-tight">
                {CHAINS[request.chain].name}
              </span>
            )}
            {displayStatus === 'pending' && !isExpired && (
              <button
                onClick={handleManualVerify}
                disabled={isVerifying}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 tracking-tight"
                title="Manually verify payment now"
              >
                <RefreshCw className={`w-3 h-3 ${isVerifying ? 'animate-spin' : ''}`} />
                {isVerifying ? 'Verifying...' : 'Verify Now'}
              </button>
            )}
          </div>
          <p className="text-sm text-white/70 mb-2 tracking-tight">{request.description || 'Payment request'}</p>
          <div className="flex items-center gap-4 text-xs text-white/50 flex-wrap">
            {request.recipient && (
              <span className="tracking-tight">To: {request.recipient.slice(0, 6)}...{request.recipient.slice(-4)}</span>
            )}
            {request.txHash && (
              <>
                <span>•</span>
                <a
                  href={`${CHAINS[request.chain]?.explorerUrl || 'https://etherscan.io'}/tx/${request.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tracking-tight text-primary-400 hover:text-primary-300 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  TX: {request.txHash.slice(0, 8)}...
                </a>
              </>
            )}
            {request.createdAt && (
              <>
                <span>•</span>
                <span className="tracking-tight">{new Date(request.createdAt).toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default PaymentRequestCard
