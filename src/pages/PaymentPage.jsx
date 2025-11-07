import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Wallet, Copy, CheckCircle2, Loader2, Clock, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react'
import { toast } from 'react-hot-toast'
import QRCode from 'qrcode.react'
import { useApp } from '../context/AppContext'
import { formatDistanceToNow } from 'date-fns'
import { CHAINS, verifyPayment } from '../services/blockchain'

const PaymentPage = () => {
  const { requestId } = useParams()
  const { getPaymentRequest } = useApp()
  const [request, setRequest] = useState(null)

  useEffect(() => {
    if (!requestId) return

    let isMounted = true

    const loadRequest = async () => {
      if (!isMounted) return false
      
      // First try from context
      let foundRequest = getPaymentRequest(requestId)
      
      // If not found, try loading from localStorage
      if (!foundRequest) {
        try {
          const savedRequests = localStorage.getItem('blockPayment_requests')
          if (savedRequests) {
            const requests = JSON.parse(savedRequests)
            foundRequest = requests.find(req => req.id === requestId)
            if (foundRequest) {
              console.log('Found request in localStorage:', foundRequest.id)
            }
          }
        } catch (error) {
          console.error('Error loading from localStorage:', error)
        }
      } else {
        console.log('Found request in context:', foundRequest.id)
      }

      // If still not found, try server
      if (!foundRequest) {
        try {
          const { paymentRequestsAPI } = await import('../services/api')
          foundRequest = await paymentRequestsAPI.getById(requestId)
          if (foundRequest) {
            console.log('Found request on server:', foundRequest.id)
            // Save to localStorage for future use
            try {
              const savedRequests = localStorage.getItem('blockPayment_requests')
              const requests = savedRequests ? JSON.parse(savedRequests) : []
              const existingIndex = requests.findIndex(r => r.id === foundRequest.id)
              if (existingIndex >= 0) {
                requests[existingIndex] = foundRequest
              } else {
                requests.unshift(foundRequest)
              }
              localStorage.setItem('blockPayment_requests', JSON.stringify(requests))
            } catch (error) {
              console.error('Error saving to localStorage:', error)
            }
          }
        } catch (error) {
          console.error('Error loading from server:', error)
        }
      }

      if (foundRequest && isMounted) {
        // Ensure request has all required fields
        const completeRequest = {
          ...foundRequest,
          chain: foundRequest.chain || 'ethereum',
          status: foundRequest.status || 'pending',
          currency: foundRequest.currency || 'ETH',
          amount: foundRequest.amount || '0',
          description: foundRequest.description || 'Payment request',
          recipient: foundRequest.recipient || foundRequest.to || '',
          createdAt: foundRequest.createdAt || foundRequest.created_at,
          expiresAt: foundRequest.expiresAt || foundRequest.expires_at,
        }
        setRequest(completeRequest)
        return true
      }
      return false
    }

    // Try immediately
    loadRequest().then(found => {
      if (!found && isMounted) {
        // Retry after delays (context might still be loading)
        const retryDelays = [1000, 2000, 3000]
        retryDelays.forEach((delay, index) => {
          setTimeout(async () => {
            if (!isMounted) return
            const found = await loadRequest()
            if (!found && index === retryDelays.length - 1) {
              console.error('Payment request not found after multiple attempts:', requestId)
            }
          }, delay)
        })
      }
    })

    return () => {
      isMounted = false
    }
  }, [requestId, getPaymentRequest])

  // Check payment status periodically
  useEffect(() => {
    if (!request || request.status === 'completed') return

    const checkPayment = async () => {
      try {
        const { verifyPayment, CHAINS } = await import('../services/blockchain')
        const chain = request.chain || 'ethereum'
        const chainConfig = CHAINS[chain]
        const isNativeCurrency = chainConfig && request.currency === chainConfig.nativeCurrency
        
        // Use request creation time to only check transactions after request was created
        const requestTimestamp = request.createdAt 
          ? new Date(request.createdAt).getTime() 
          : null
        
        const result = await verifyPayment(
          chain,
          request.recipient,
          request.amount,
          isNativeCurrency ? 'native' : request.currency,
          requestTimestamp
        )

        if (result?.verified && result.txHash && request.status === 'pending') {
          toast.success(`Payment detected! TX: ${result.txHash.slice(0, 8)}...`)
        }
      } catch (error) {
        console.error('Payment check error:', error)
      }
    }

    // Check every 20 seconds (less frequent to reduce load)
    const interval = setInterval(checkPayment, 20000)
    checkPayment() // Initial check

    return () => clearInterval(interval)
  }, [request])

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const handleCopyAddress = () => {
    if (request.recipient) {
      copyToClipboard(request.recipient)
      toast.success('Address copied! Paste it in your wallet to send payment.')
    }
  }

  // Add loading state with timeout
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  
  useEffect(() => {
    if (!request && requestId) {
      const timeout = setTimeout(() => {
        setLoadingTimeout(true)
      }, 5000) // Show error after 5 seconds
      
      return () => clearTimeout(timeout)
    } else {
      setLoadingTimeout(false)
    }
  }, [request, requestId])

  if (!request) {
    if (loadingTimeout) {
      return (
        <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-white/60 text-lg mb-2 tracking-tight">Payment request not found</p>
            <p className="text-white/40 text-sm tracking-tight mb-4">
              The request ID <code className="text-xs bg-white/5 px-2 py-1 rounded">{requestId}</code> may be invalid or expired
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all text-white/80 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </a>
          </div>
        </div>
      )
    }
    
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-white/60" />
          </div>
          <p className="text-white/60 text-lg mb-2 tracking-tight">Loading payment request...</p>
          <p className="text-white/40 text-sm tracking-tight">Please wait while we fetch the details</p>
        </div>
      </div>
    )
  }

  const isPaid = request.status === 'completed'
  const isExpired = request.isExpired || (request.expiresAt && new Date(request.expiresAt) < new Date())
  const paymentUrl = `${window.location.origin}/pay/${request.id}`
  
  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!request.expiresAt || isExpired) return null
    const now = new Date()
    const expires = new Date(request.expiresAt)
    const diff = expires - now
    if (diff <= 0) return null
    
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }
  
  const timeRemaining = getTimeRemaining()

  return (
    <div className="max-w-4xl mx-auto">
      <a
        href="/"
        className="inline-flex items-center gap-2 text-dark-400 hover:text-white mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </a>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payment Details */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass rounded-2xl p-8 border border-white/10 space-y-6"
        >
          <div>
            <h1 className="text-3xl font-bold mb-2">Payment Request</h1>
            <p className="text-dark-400">{request.description}</p>
          </div>

          <div className="space-y-4">
            <div className="glass-strong rounded-2xl p-5 border border-white/[0.12]">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-white/60 tracking-tight">Amount</div>
                <div className="flex items-center gap-2">
                  {timeRemaining && (
                    <div className="px-3 py-1 rounded-full bg-primary-500/20 border border-primary-500/30 text-xs text-primary-400 tracking-tight flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {timeRemaining}
                    </div>
                  )}
                  {request.chain && (
                    <div className="px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.12] text-xs text-white/80 tracking-tight">
                      {CHAINS[request.chain]?.name || request.chain}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-3xl font-semibold tracking-tight">
                {request.amount} {request.currency}
              </div>
            </div>

            <div className="glass-strong rounded-2xl p-5 border border-white/[0.12] space-y-4">
              <div>
                <div className="text-sm text-white/60 mb-3 tracking-tight">Send Payment To</div>
                <div className="flex items-center justify-between gap-3 p-4 bg-white/[0.04] rounded-xl border border-white/[0.08]">
                  <p className="font-mono text-sm break-all text-white flex-1">{request.recipient || 'Not set'}</p>
                  {request.recipient && (
                    <button
                      onClick={handleCopyAddress}
                      className="text-primary-400 hover:text-primary-300 flex-shrink-0 p-2.5 glass-strong rounded-lg border border-primary-500/30 hover:bg-primary-500/10 transition-all"
                      title="Copy address"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {request.createdAt && (
                <div>
                  <div className="text-sm text-white/60 mb-1.5 tracking-tight">Created</div>
                  <p className="text-sm text-white/80 tracking-tight">
                    {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {isPaid ? (
            <div className="glass-strong rounded-2xl p-5 bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <div className="font-semibold text-green-400 mb-1 tracking-tight">Payment Completed</div>
                  <div className="text-sm text-white/60 tracking-tight">This request has been paid</div>
                </div>
              </div>
            </div>
          ) : isExpired ? (
            <div className="glass-strong rounded-2xl p-5 bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <div className="font-semibold text-red-400 mb-1 tracking-tight">Request Expired</div>
                  <div className="text-sm text-white/60 tracking-tight">This payment request has expired (valid for 1 hour)</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="glass-strong rounded-2xl p-6 bg-primary-500/10 border border-primary-500/30">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-5 h-5 text-primary-300" />
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-semibold text-primary-300 mb-3 tracking-tight text-lg">Payment Instructions</div>
                    <p className="text-xs text-white/70 mb-3 tracking-tight">
                      Send <span className="font-semibold text-white">{request.amount} {request.currency}</span> on <span className="font-semibold text-white">{CHAINS[request.chain]?.name || request.chain}</span> directly to the recipient address below. Only send this exact asset on this chain—other tokens or networks may be lost.
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-white/80 text-[15px] leading-relaxed">
                      <li className="tracking-tight">Copy the recipient address.</li>
                      <li className="tracking-tight">Open your wallet and switch to {CHAINS[request.chain]?.name || request.chain}.</li>
                      <li className="tracking-tight">Send exactly <span className="font-semibold text-white">{request.amount} {request.currency}</span> to the address.</li>
                      <li className="tracking-tight">Wait for confirmations—we’ll update this page automatically.</li>
                    </ol>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 mb-4">
                  <div className="glass rounded-xl border border-white/10 p-4">
                    <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">Amount Due</p>
                    <p className="text-white text-lg font-semibold tracking-tight">{request.amount} {request.currency}</p>
                  </div>
                  <div className="glass rounded-xl border border-white/10 p-4">
                    <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">Network</p>
                    <p className="text-white text-lg font-semibold tracking-tight">{CHAINS[request.chain]?.name || request.chain}</p>
                  </div>
                </div>

                <button
                  onClick={handleCopyAddress}
                  className="w-full px-6 py-3 glass-strong border border-primary-500/30 text-primary-400 hover:bg-primary-500/10 rounded-xl font-medium transition-all flex items-center justify-center gap-2.5 tracking-tight"
                >
                  <Copy className="w-4 h-4" />
                  Copy Recipient Address
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* QR Code */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="glass rounded-3xl p-8 border border-white/[0.08]"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-2 gradient-text tracking-tight">
              Scan to Pay
            </h2>
            <p className="text-sm text-white/60 tracking-tight">
              Scan this QR code with your wallet to send <span className="text-white">{request.amount} {request.currency}</span> on {CHAINS[request.chain]?.name || request.chain}.
            </p>
          </div>

          <div className="glass-strong rounded-2xl p-6 flex items-center justify-center mb-6 border border-white/[0.12]">
            <div className="w-64 h-64 bg-white rounded-2xl p-4 flex items-center justify-center shadow-soft-lg">
              <QRCode 
                value={request.recipient || ''}
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
        </motion.div>
      </div>
    </div>
  )
}

export default PaymentPage

