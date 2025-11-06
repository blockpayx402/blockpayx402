import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { paymentRequestsAPI, transactionsAPI, syncAPI, healthCheck } from '../services/api'

const AppContext = createContext()

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}

export const AppProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null)
  const [paymentRequests, setPaymentRequests] = useState([])
  const [transactions, setTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const syncTimeoutRef = useRef(null)
  const monitoringIntervalsRef = useRef(new Map())

  // Load data from server and localStorage on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        // Check if server is available
        const serverHealthy = await healthCheck()
        
        if (serverHealthy) {
          // Load from server
          try {
            const [serverRequests, serverTransactions] = await Promise.all([
              paymentRequestsAPI.getAll(),
              transactionsAPI.getAll()
            ])
            
            const requests = Array.isArray(serverRequests) ? serverRequests : []
            const transactions = Array.isArray(serverTransactions) ? serverTransactions : []
            
            setPaymentRequests(requests)
            setTransactions(transactions)
            
            // Debug log
            console.log('✅ Loaded from server:', {
              requests: requests.length,
              transactions: transactions.length
            })
            
            // Also save to localStorage as backup
            if (serverRequests) {
              localStorage.setItem('blockPayment_requests', JSON.stringify(serverRequests))
            }
            if (serverTransactions) {
              localStorage.setItem('blockPayment_transactions', JSON.stringify(serverTransactions))
            }
            
            // Note: Monitoring will be restarted after startPaymentMonitoring is defined
            // This is handled in a separate useEffect below
          } catch (error) {
            console.error('Error loading from server, falling back to localStorage:', error)
            loadFromLocalStorage()
          }
        } else {
          // Server not available, load from localStorage
          console.log('Server not available, using localStorage')
          loadFromLocalStorage()
        }
      } catch (error) {
        console.error('Error loading data:', error)
        loadFromLocalStorage()
      } finally {
        setIsLoading(false)
      }
    }
    
    const loadFromLocalStorage = () => {
      try {
        const savedRequests = localStorage.getItem('blockPayment_requests')
        const savedTransactions = localStorage.getItem('blockPayment_transactions')

        console.log('Loading from localStorage:', {
          hasRequests: !!savedRequests,
          hasTransactions: !!savedTransactions
        })

        if (savedRequests) {
          const requests = JSON.parse(savedRequests)
          const validRequests = Array.isArray(requests) ? requests : []
          setPaymentRequests(validRequests)
          console.log('Loaded requests from localStorage:', validRequests.length)
        } else {
          console.log('No requests found in localStorage')
          setPaymentRequests([])
        }

        if (savedTransactions) {
          const txs = JSON.parse(savedTransactions)
          const validTxs = Array.isArray(txs) ? txs : []
          setTransactions(validTxs)
          console.log('Loaded transactions from localStorage:', validTxs.length)
        } else {
          console.log('No transactions found in localStorage')
          setTransactions([])
        }
      } catch (error) {
        console.error('Error loading from localStorage:', error)
        setPaymentRequests([])
        setTransactions([])
      }
    }
    
    loadData()
  }, [])

  // Debounced sync function
  const syncToServer = useCallback((requests, txs) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }
    
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        await syncAPI.syncAll(requests, txs)
      } catch (error) {
        console.error('Error syncing to server:', error)
      }
    }, 1500)
  }, [])

  // Save payment requests to server and localStorage
  useEffect(() => {
    if (paymentRequests.length > 0 || localStorage.getItem('blockPayment_requests')) {
      // Save to localStorage immediately
      try {
        localStorage.setItem('blockPayment_requests', JSON.stringify(paymentRequests))
      } catch (error) {
        console.error('Error saving to localStorage:', error)
      }
      
      // Sync to server (debounced)
      syncToServer(paymentRequests, transactions)
    }
  }, [paymentRequests, transactions, syncToServer])

  // Save transactions to server and localStorage
  useEffect(() => {
    if (transactions.length > 0 || localStorage.getItem('blockPayment_transactions')) {
      // Save to localStorage immediately
      try {
        localStorage.setItem('blockPayment_transactions', JSON.stringify(transactions))
      } catch (error) {
        console.error('Error saving to localStorage:', error)
      }
      
      // Sync to server (debounced)
      syncToServer(paymentRequests, transactions)
    }
  }, [transactions, paymentRequests, syncToServer])

  // Save wallet to localStorage
  useEffect(() => {
    if (wallet) {
      try {
        localStorage.setItem('blockPayment_wallet', JSON.stringify(wallet))
      } catch (error) {
        console.error('Error saving wallet:', error)
      }
    } else {
      localStorage.removeItem('blockPayment_wallet')
    }
  }, [wallet])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
      // Clean up all monitoring intervals
      monitoringIntervalsRef.current.forEach(interval => clearInterval(interval))
      monitoringIntervalsRef.current.clear()
    }
  }, [])

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        // Request account access
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        })

        if (accounts.length > 0) {
          const address = accounts[0]
          const balance = await getBalance(address)
          
          const walletData = {
            address,
            balance,
            provider: 'metamask',
            connected: true
          }
          
          setWallet(walletData)
          toast.success('Wallet connected successfully!')
          return true
        }
      } else {
        // Fallback: simulate wallet connection for demo
        const demoAddress = '0x' + Array.from({ length: 40 }, () => 
          Math.floor(Math.random() * 16).toString(16)
        ).join('')
        
        const walletData = {
          address: demoAddress,
          balance: '0.0',
          provider: 'demo',
          connected: true
        }
        
        setWallet(walletData)
        toast.success('Demo wallet connected! Install MetaMask for real wallet support.')
        return true
      }
    } catch (error) {
      console.error('Wallet connection error:', error)
      if (error.code === 4001) {
        toast.error('Wallet connection rejected')
      } else {
        toast.error('Failed to connect wallet')
      }
      return false
    }
  }

  const disconnectWallet = () => {
    setWallet(null)
    toast.success('Wallet disconnected')
  }

  const getBalance = async (address) => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const balance = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [address, 'latest'],
        })
        // Convert from Wei to ETH
        const balanceInEth = (parseInt(balance, 16) / Math.pow(10, 18)).toFixed(4)
        return balanceInEth
      }
    } catch (error) {
      console.error('Balance fetch error:', error)
    }
    return '0.0'
  }

  const updatePaymentRequestStatus = useCallback(async (requestId, status) => {
    console.log(`🔄 Updating request ${requestId} status to: ${status}`)
    
    // Update UI immediately (optimistic update)
    setPaymentRequests(prev => {
      const updated = prev.map(req =>
        req.id === requestId
          ? { ...req, status, updatedAt: new Date().toISOString() }
          : req
      )
      
      // Update on server
      const updatedRequest = updated.find(req => req.id === requestId)
      if (updatedRequest) {
        paymentRequestsAPI.update(requestId, { status }).then(() => {
          console.log(`✅ Request ${requestId} status updated to ${status} on server`)
        }).catch(error => {
          console.error('Error updating request on server:', error)
        })
      }
      
      return updated
    })
  }, [])

  const addTransaction = useCallback(async (transaction) => {
    // Check if transaction already exists (by txHash or requestId)
    const existingTx = transactions.find(tx => 
      (tx.txHash && transaction.txHash && tx.txHash === transaction.txHash) ||
      (tx.requestId && transaction.requestId && tx.requestId === transaction.requestId && tx.status === 'completed')
    )

    if (existingTx) {
      console.log('Transaction already exists, skipping:', existingTx.id)
      return existingTx
    }

    const newTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      ...transaction,
      timestamp: transaction.timestamp || new Date().toISOString(),
    }

    console.log('Saving transaction:', {
      id: newTransaction.id,
      requestId: newTransaction.requestId,
      txHash: newTransaction.txHash,
      amount: newTransaction.amount,
      currency: newTransaction.currency
    })

    // Save to server first
    try {
      const savedTransaction = await transactionsAPI.create(newTransaction)
      console.log('Transaction saved to server:', savedTransaction.id)
      
      // Update state with server response
      setTransactions(prev => {
        // Check if already exists in state
        const exists = prev.find(tx => tx.id === savedTransaction.id)
        if (exists) return prev
        
        return [savedTransaction, ...prev]
      })
      
      // Also save to localStorage immediately
      try {
        const currentTransactions = JSON.parse(localStorage.getItem('blockPayment_transactions') || '[]')
        const updatedTransactions = [savedTransaction, ...currentTransactions.filter(tx => tx.id !== savedTransaction.id)]
        localStorage.setItem('blockPayment_transactions', JSON.stringify(updatedTransactions))
      } catch (error) {
        console.error('Error saving transaction to localStorage:', error)
      }

      return savedTransaction
    } catch (error) {
      console.error('Error creating transaction on server:', error)
      // Fallback: save locally
      setTransactions(prev => {
        // Check if already exists in state
        const exists = prev.find(tx => tx.id === newTransaction.id)
        if (exists) return prev
        
        return [newTransaction, ...prev]
      })
      
      // Save to localStorage
      try {
        const currentTransactions = JSON.parse(localStorage.getItem('blockPayment_transactions') || '[]')
        const updatedTransactions = [newTransaction, ...currentTransactions.filter(tx => tx.id !== newTransaction.id)]
        localStorage.setItem('blockPayment_transactions', JSON.stringify(updatedTransactions))
      } catch (error) {
        console.error('Error saving transaction to localStorage:', error)
      }

      return newTransaction
    }
  }, [transactions])

  const startPaymentMonitoring = useCallback((requestId) => {
    // Clear any existing interval for this request
    if (monitoringIntervalsRef.current.has(requestId)) {
      console.log('⚠️  Clearing existing monitoring for request:', requestId)
      clearInterval(monitoringIntervalsRef.current.get(requestId))
    }

    console.log('🔄 Starting payment monitoring for request:', requestId)

    // Get the request creation timestamp to only check transactions after request was created
    const requestCreationTime = new Date().getTime()
    let checkCount = 0
    let lastErrorCount = 0

    // Check payment every 10 seconds for faster detection
    const interval = setInterval(async () => {
      try {
        checkCount++
        console.log(`🔍 [Check #${checkCount}] Verifying payment for request: ${requestId}`)
        
        // Get latest state from React state
        setPaymentRequests(currentRequests => {
          const updatedRequest = currentRequests.find(r => r.id === requestId)
          
          if (!updatedRequest) {
            console.log('⚠️  Request not found, stopping monitoring:', requestId)
            clearInterval(interval)
            monitoringIntervalsRef.current.delete(requestId)
            return currentRequests
          }

          // Check if request is expired or already completed
          const isExpired = updatedRequest.expiresAt && new Date(updatedRequest.expiresAt) < new Date()
          if (isExpired || updatedRequest.status === 'completed') {
            console.log(`✅ Request ${updatedRequest.status === 'completed' ? 'completed' : 'expired'}, stopping monitoring:`, requestId)
            clearInterval(interval)
            monitoringIntervalsRef.current.delete(requestId)
            if (isExpired && updatedRequest.status === 'pending') {
              updatePaymentRequestStatus(requestId, 'expired')
            }
            return currentRequests
          }

          // Verify payment on blockchain with transaction history check
          import('../services/blockchain').then(({ verifyPayment, CHAINS }) => {
            const chain = updatedRequest.chain || 'ethereum'
            const chainConfig = CHAINS[chain]
            const isNativeCurrency = chainConfig && updatedRequest.currency === chainConfig.nativeCurrency
            
            // Use request creation time to only check transactions after request was created
            const requestTimestamp = updatedRequest.createdAt 
              ? new Date(updatedRequest.createdAt).getTime() 
              : requestCreationTime
            
            console.log(`🔎 Checking blockchain for payment:`, {
              chain,
              recipient: updatedRequest.recipient,
              amount: updatedRequest.amount,
              currency: updatedRequest.currency,
              sinceTimestamp: new Date(requestTimestamp).toISOString()
            })
            
            verifyPayment(
              chain,
              updatedRequest.recipient,
              updatedRequest.amount,
              isNativeCurrency ? 'native' : updatedRequest.currency,
              requestTimestamp
            ).then(async (result) => {
              if (result?.verified && result.txHash) {
                console.log('✅ Payment verified on blockchain!', {
                  requestId,
                  txHash: result.txHash,
                  from: result.from,
                  amount: result.amount
                })

                // Stop monitoring immediately
                clearInterval(interval)
                monitoringIntervalsRef.current.delete(requestId)

                // Update payment request status to completed IMMEDIATELY
                setPaymentRequests(prev => {
                  const updated = prev.map(req =>
                    req.id === requestId
                      ? { ...req, status: 'completed', updatedAt: new Date().toISOString() }
                      : req
                  )
                  return updated
                })
                
                // Update on server
                await updatePaymentRequestStatus(requestId, 'completed')
                
                // Save transaction with actual blockchain data
                const savedTx = await addTransaction({
                  requestId: requestId,
                  amount: result.amount?.toString() || updatedRequest.amount,
                  currency: updatedRequest.currency,
                  from: result.from || 'Unknown',
                  to: result.to || updatedRequest.recipient,
                  status: 'completed',
                  description: updatedRequest.description || 'Payment verified',
                  chain: updatedRequest.chain,
                  txHash: result.txHash,
                  timestamp: result.timestamp || result.blockTime || new Date().toISOString(),
                })
                
                console.log('✅ Transaction saved:', savedTx.id)
                toast.success(`✅ Payment verified! Status updated to completed. TX: ${result.txHash.slice(0, 8)}...`)
              } else {
                // Update last checked time and save to server
                const lastChecked = new Date().toISOString()
                setPaymentRequests(prev =>
                  prev.map(req =>
                    req.id === requestId
                      ? { ...req, lastChecked }
                      : req
                  )
                )
                
                // Save lastChecked to server
                paymentRequestsAPI.update(requestId, { lastChecked }).catch(err => {
                  console.error('Error updating lastChecked on server:', err)
                })
                
                // Log periodic status (every 10 checks = ~3.3 minutes)
                if (checkCount % 10 === 0) {
                  console.log(`⏳ Still monitoring payment for request ${requestId} (check #${checkCount})`)
                }
                
                lastErrorCount = 0 // Reset error count on successful check
              }
            }).catch(error => {
              lastErrorCount++
              console.error(`❌ Payment verification error (attempt ${lastErrorCount}):`, error.message || error)
              
              // If too many consecutive errors, log warning
              if (lastErrorCount >= 5) {
                console.warn(`⚠️  Multiple verification errors for request ${requestId}, but continuing to monitor...`)
              }
            })
          }).catch(error => {
            console.error('❌ Error importing blockchain service:', error)
            lastErrorCount++
          })

          return currentRequests
        })
      } catch (error) {
        console.error('❌ Error in payment monitoring:', error)
        lastErrorCount++
      }
    }, 10000) // Check every 10 seconds for faster auto-detection

    monitoringIntervalsRef.current.set(requestId, interval)
    console.log('✅ Monitoring started for request:', requestId)

    // Clean up after 1 hour (when request expires)
    setTimeout(() => {
      if (monitoringIntervalsRef.current.has(requestId)) {
        console.log('⏰ Request expired, cleaning up monitoring:', requestId)
        clearInterval(monitoringIntervalsRef.current.get(requestId))
        monitoringIntervalsRef.current.delete(requestId)
      }
    }, 3600000) // 1 hour
  }, [updatePaymentRequestStatus, addTransaction])

  // Restart monitoring for pending requests when data is loaded
  // This must be after startPaymentMonitoring is defined
  useEffect(() => {
    if (!isLoading && paymentRequests.length > 0 && startPaymentMonitoring) {
      paymentRequests.forEach(request => {
        if (request.status === 'pending' && request.recipient) {
          const isExpired = request.expiresAt && new Date(request.expiresAt) < new Date()
          if (!isExpired && !monitoringIntervalsRef.current.has(request.id)) {
            console.log('🔄 Restarting monitoring for request:', request.id)
            startPaymentMonitoring(request.id)
          }
        }
      })
    }
  }, [isLoading, paymentRequests, startPaymentMonitoring])

  const createPaymentRequest = useCallback(async (requestData) => {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
    
    const newRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      ...requestData,
      chain: requestData.chain || 'ethereum',
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      recipient: requestData.recipient || '',
      lastChecked: null,
    }

    // Save to server
    try {
      const savedRequest = await paymentRequestsAPI.create(newRequest)
      setPaymentRequests(prev => [savedRequest, ...prev])
      
      // Start monitoring this payment request IMMEDIATELY
      if (savedRequest.recipient) {
        console.log('🚀 Starting auto-monitoring for new request:', savedRequest.id)
        startPaymentMonitoring(savedRequest.id)
      }
      
      toast.success(`Payment request created! Valid for 1 hour.`)
      
      return savedRequest
    } catch (error) {
      console.error('Error creating request on server:', error)
      // Fallback: save locally
      setPaymentRequests(prev => [newRequest, ...prev])
      
      // Start monitoring this payment request IMMEDIATELY
      if (newRequest.recipient) {
        console.log('🚀 Starting auto-monitoring for new request:', newRequest.id)
        startPaymentMonitoring(newRequest.id)
      }
      
      toast.success(`Payment request created! Valid for 1 hour.`)
      
      return newRequest
    }
  }, [startPaymentMonitoring])

  const getPaymentRequest = useCallback((id) => {
    return paymentRequests.find(req => req.id === id)
  }, [paymentRequests])

  const getStats = useCallback(() => {
    const completed = paymentRequests.filter(req => req.status === 'completed').length
    const pending = paymentRequests.filter(req => req.status === 'pending').length
    const failed = paymentRequests.filter(req => req.status === 'failed').length

    const totalRevenue = paymentRequests
      .filter(req => req.status === 'completed')
      .reduce((sum, req) => {
        const amount = parseFloat(req.amount) || 0
        return sum + amount
      }, 0)

    const totalRequests = paymentRequests.length
    const successRate = totalRequests > 0 
      ? ((completed / totalRequests) * 100).toFixed(1) 
      : '0.0'

    return {
      totalRevenue: totalRevenue.toFixed(2),
      activeRequests: pending,
      pendingPayments: pending,
      completedPayments: completed,
      failedPayments: failed,
      growthRate: successRate,
    }
  }, [paymentRequests])

  return (
    <AppContext.Provider
      value={{
        wallet,
        connectWallet,
        disconnectWallet,
        paymentRequests,
        createPaymentRequest,
        updatePaymentRequestStatus,
        getPaymentRequest,
        transactions,
        addTransaction,
        getStats,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
