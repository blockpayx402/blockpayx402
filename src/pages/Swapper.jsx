import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, RefreshCw, Loader2, ArrowUpDown, CheckCircle2, Copy, ExternalLink, Wallet, Maximize2, AlertCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import QRCode from 'qrcode.react'
import { ordersAPI, relayAPI } from '../services/api'
import { useApp } from '../context/AppContext'

const Swapper = () => {
  const navigate = useNavigate()
  const { wallet, connectWallet, disconnectWallet } = useApp()
  
  // Swap direction: from -> to
  const [fromChain, setFromChain] = useState(null)
  const [fromAsset, setFromAsset] = useState(null)
  const [fromAmount, setFromAmount] = useState('')
  const [walletBalance, setWalletBalance] = useState('0.0')
  const [balanceLoading, setBalanceLoading] = useState(false)
  
  const [toChain, setToChain] = useState(null)
  const [toAsset, setToAsset] = useState(null)
  const [toAmount, setToAmount] = useState('')
  
  const [recipientAddress, setRecipientAddress] = useState('')
  const [refundAddress, setRefundAddress] = useState('')
  const [showRefund, setShowRefund] = useState(false)
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [order, setOrder] = useState(null)
  const [orderStatus, setOrderStatus] = useState(null)
  const [statusPolling, setStatusPolling] = useState(false)
  const debounceTimer = useRef(null)

  // Dynamic chains and tokens from Relay
  const [availableChains, setAvailableChains] = useState([])
  const [chainsLoading, setChainsLoading] = useState(true)
  const [fromChainTokens, setFromChainTokens] = useState([])
  const [toChainTokens, setToChainTokens] = useState([])
  const [tokensLoading, setTokensLoading] = useState(false)

  // Fetch all chains from Relay on mount
  useEffect(() => {
    const fetchChains = async () => {
      setChainsLoading(true)
      try {
        const chains = await relayAPI.getChains()
        setAvailableChains(chains)
        
        // Set default chains if available
        if (chains.length > 0) {
          const defaultFrom = chains.find(c => c.value === 'ethereum' || c.value === '1') || chains[0]
          const defaultTo = chains.find(c => c.value === 'bnb' || c.value === '56') || chains[0]
          setFromChain(defaultFrom.value)
          setToChain(defaultTo.value)
        }
      } catch (error) {
        console.error('Error fetching chains:', error)
        toast.error('Failed to load chains. Please refresh the page.')
      } finally {
        setChainsLoading(false)
      }
    }
    
    fetchChains()
  }, [])

  // Fetch tokens when chain changes
  useEffect(() => {
    const fetchTokens = async () => {
      if (!fromChain || availableChains.length === 0) return
      
      setTokensLoading(true)
      setFromChainTokens([]) // Clear previous tokens
      try {
        const chain = availableChains.find(c => c.value === fromChain || c.chainId?.toString() === fromChain)
        if (chain && chain.chainId) {
          console.log('[Swapper] Fetching tokens for chain:', chain.label, 'chainId:', chain.chainId)
          const tokens = await relayAPI.getTokens(chain.chainId)
          console.log('[Swapper] Received tokens:', tokens.length, 'tokens:', tokens)
          // Ensure tokens have the required fields
          const formattedTokens = tokens.map(token => ({
            symbol: token.symbol || token.name || 'UNKNOWN',
            address: token.address || token.contractAddress || '',
            decimals: token.decimals || 18,
            name: token.name || token.symbol || 'Unknown Token',
            isNative: token.isNative || token.address === '0x0000000000000000000000000000000000000000' || !token.address,
          }))
          console.log('[Swapper] Formatted tokens:', formattedTokens.length)
          setFromChainTokens(formattedTokens)
          
          // Set default token if available - use first available token (no hardcoded preferences)
          if (formattedTokens.length > 0 && !fromAsset) {
            // Prefer native token, otherwise use first token
            const defaultToken = formattedTokens.find(t => t.isNative) || formattedTokens[0]
            setFromAsset(defaultToken.symbol)
            console.log('[Swapper] Set default token:', defaultToken.symbol)
          }
        } else {
          console.warn('[Swapper] Chain not found or missing chainId:', fromChain, chain)
        }
      } catch (error) {
        console.error('Error fetching from chain tokens:', error)
        toast.error(`Failed to load tokens for ${fromChain}. Please try again.`)
      } finally {
        setTokensLoading(false)
      }
    }
    
    fetchTokens()
  }, [fromChain, availableChains])

  useEffect(() => {
    const fetchTokens = async () => {
      if (!toChain || availableChains.length === 0) return
      
      try {
        const chain = availableChains.find(c => c.value === toChain)
        if (chain && chain.chainId) {
          console.log('[Swapper] Fetching tokens for toChain:', chain.label, 'chainId:', chain.chainId)
          const tokens = await relayAPI.getTokens(chain.chainId)
          console.log('[Swapper] Received toChain tokens:', tokens.length)
          setToChainTokens(tokens)
          
          // Set default token if available - use first available token (no hardcoded preferences)
          if (tokens.length > 0 && !toAsset) {
            // Prefer native token, otherwise use first token
            const defaultToken = tokens.find(t => t.isNative) || tokens[0]
            setToAsset(defaultToken.symbol)
          }
        } else {
          console.warn('[Swapper] ToChain not found or missing chainId:', toChain, chain)
        }
      } catch (error) {
        console.error('Error fetching to chain tokens:', error)
      }
    }
    
    fetchTokens()
  }, [toChain, availableChains])

  const fromChainConfig = availableChains.find(c => c.value === fromChain)
  const toChainConfig = availableChains.find(c => c.value === toChain)

  // Dynamic chain detection - no hardcoded mappings
  // Match wallet chain ID to available chains from Relay

  // Auto-detect chain from wallet when connected
  useEffect(() => {
    if (wallet?.connected && wallet?.chain === 'evm' && typeof window.ethereum !== 'undefined') {
      const detectChain = async () => {
        try {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' })
          const chainIdNum = parseInt(chainId, 16).toString()
          
          // Auto-set from chain if wallet is on a supported chain - match dynamically
          const matchingChain = availableChains.find(c => 
            c.chainId?.toString() === chainIdNum ||
            c.chainId?.toString() === chainId
          )
          
          if (matchingChain) {
            setFromChain(matchingChain.value)
          }
        } catch (error) {
          console.error('Error detecting chain:', error)
        }
      }
      detectChain()
    } else if (wallet?.connected && wallet?.chain === 'solana') {
      // Auto-set to Solana if Solana wallet connected - find dynamically
      const solanaChain = availableChains.find(c => 
        (c.name || '').toLowerCase().includes('solana') ||
        (c.symbol || '').toUpperCase() === 'SOL' ||
        (c.nativeCurrency?.symbol || '').toUpperCase() === 'SOL'
      )
      if (solanaChain) {
        setFromChain(solanaChain.value)
      }
    }
  }, [wallet?.connected, wallet?.chain, availableChains])

  // Auto-fill recipient address from wallet
  useEffect(() => {
    if (wallet?.connected && wallet?.address) {
      // Auto-fill recipient address
      setRecipientAddress(wallet.address)
      
      // Auto-fill refund address
      if (!refundAddress) {
        setRefundAddress(wallet.address)
      }
    }
  }, [wallet?.connected, wallet?.address])

  // Fetch wallet balance when chain/asset changes
  useEffect(() => {
    const fetchBalance = async () => {
      if (!wallet?.connected || !wallet?.address || !fromAsset || !fromChain) {
        setWalletBalance('0.0')
        return
      }

      // Check if wallet chain matches from chain - detect dynamically
      const walletChainType = wallet.chain || (wallet.provider === 'phantom' || wallet.provider === 'solflare' ? 'solana' : 'evm')
      
      // Detect selected chain type from chain data
      const fromChainData = availableChains.find(c => c.value === fromChain)
      const isSelectedChainSolana = fromChainData && (
        (fromChainData.name || '').toLowerCase().includes('solana') ||
        (fromChainData.symbol || '').toUpperCase() === 'SOL'
      )
      const selectedChainType = isSelectedChainSolana ? 'solana' : 'evm'
      
      // Only fetch balance if chains match and currency is selected
      if (walletChainType !== selectedChainType || !fromChain || !fromAsset) {
        setWalletBalance('0.0')
        return
      }
      
      setBalanceLoading(true)
      try {
        // Find the selected token to get its address and decimals
        const selectedToken = fromChainTokens.find(t => 
          t.symbol?.toUpperCase() === fromAsset.toUpperCase()
        )
        const isNative = selectedToken?.isNative || 
                        ['ETH', 'BNB', 'MATIC', 'SOL'].includes(fromAsset.toUpperCase())
        
        if (walletChainType === 'solana' && wallet.address) {
          const { CHAINS } = await import('../services/blockchain')
          const rpcUrl = CHAINS.solana?.rpcUrls?.[0] || CHAINS.solana?.rpcUrl
          
          if (isNative || fromAsset.toUpperCase() === 'SOL') {
            // Native SOL balance
            if (rpcUrl) {
              const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'getBalance',
                  params: [wallet.address]
                })
              })
              
              const data = await response.json()
              if (data.result) {
                const decimals = selectedToken?.decimals || 9
                const balance = data.result.value / Math.pow(10, decimals)
                setWalletBalance(balance.toFixed(6))
              }
            }
          } else if (selectedToken?.address) {
            // SPL Token balance
            try {
              const solana = await import('@solana/web3.js')
              const connection = new solana.Connection(rpcUrl || 'https://api.mainnet-beta.solana.com')
              const publicKey = new solana.PublicKey(wallet.address)
              const tokenMint = new solana.PublicKey(selectedToken.address)
              
              // Get token accounts
              const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                mint: tokenMint
              })
              
              if (tokenAccounts.value.length > 0) {
                const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount
                const decimals = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.decimals
                setWalletBalance(balance.toFixed(6))
              } else {
                setWalletBalance('0.0')
              }
            } catch (error) {
              console.error('Error fetching SPL token balance:', error)
              setWalletBalance('0.0')
            }
          }
        } else if (walletChainType === 'evm' && wallet.address && typeof window.ethereum !== 'undefined') {
          if (isNative || ['ETH', 'BNB', 'MATIC'].includes(fromAsset.toUpperCase())) {
            // Native token balance
            const balance = await window.ethereum.request({
              method: 'eth_getBalance',
              params: [wallet.address, 'latest'],
            })
            const decimals = selectedToken?.decimals || 18
            const balanceInTokens = (parseInt(balance, 16) / Math.pow(10, decimals)).toFixed(6)
            setWalletBalance(balanceInTokens)
          } else if (selectedToken?.address && selectedToken.address.trim() !== '' && selectedToken.address !== '0x0000000000000000000000000000000000000000') {
            // ERC20 token balance - only if address is valid
            try {
              const { ethers } = await import('ethers')
              const provider = new ethers.BrowserProvider(window.ethereum)
              
              // Validate address format
              if (!ethers.isAddress(selectedToken.address)) {
                console.warn('Invalid token address:', selectedToken.address)
                setWalletBalance('0.0')
                return
              }
              
              // ERC20 balanceOf ABI
              const erc20Abi = [
                {
                  constant: true,
                  inputs: [{ name: '_owner', type: 'address' }],
                  name: 'balanceOf',
                  outputs: [{ name: 'balance', type: 'uint256' }],
                  type: 'function'
                },
                {
                  constant: true,
                  inputs: [],
                  name: 'decimals',
                  outputs: [{ name: '', type: 'uint8' }],
                  type: 'function'
                }
              ]
              
              const tokenContract = new ethers.Contract(selectedToken.address, erc20Abi, provider)
              const balance = await tokenContract.balanceOf(wallet.address)
              const decimals = selectedToken.decimals || await tokenContract.decimals().catch(() => 18)
              const balanceInTokens = ethers.formatUnits(balance, decimals)
              setWalletBalance(parseFloat(balanceInTokens).toFixed(6))
            } catch (error) {
              console.error('Error fetching ERC20 token balance:', error)
              // If it's a contract error (invalid address or contract doesn't exist), set to 0
              if (error.code === 'BAD_DATA' || error.message?.includes('decode')) {
                console.warn('Token contract may not exist or address is invalid:', selectedToken.address)
                setWalletBalance('0.0')
              } else {
                setWalletBalance('0.0')
              }
            }
          } else {
            setWalletBalance('0.0')
          }
        }
      } catch (error) {
        console.error('Error fetching wallet balance:', error)
        setWalletBalance('0.0')
      } finally {
        setBalanceLoading(false)
      }
    }
    
    fetchBalance()
  }, [wallet, fromChain, fromAsset, fromChainTokens])

  // Auto-calculate "to" amount when "from" amount changes
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    const calculateRate = async () => {
      // Don't calculate if same currency on same chain (direct transfer, not swap)
      if (fromChain === toChain && fromAsset?.toUpperCase() === toAsset?.toUpperCase()) {
        setToAmount(fromAmount)
        return
      }

      if (fromAmount && parseFloat(fromAmount) > 0 && fromChain && fromAsset && toChain && toAsset) {
        setCalculating(true)
        try {
          // Get chain IDs from available chains
          const fromChainData = availableChains.find(c => c.value === fromChain || c.chainId?.toString() === fromChain)
          const toChainData = availableChains.find(c => c.value === toChain || c.chainId?.toString() === toChain)
          
          // Use chainId if available, otherwise use chain name/value
          const fromChainId = fromChainData?.chainId?.toString() || fromChain
          const toChainId = toChainData?.chainId?.toString() || toChain
          
          console.log('[Swapper] Getting exchange rate:', {
            fromChain,
            fromChainId,
            fromAsset,
            toChain,
            toChainId,
            toAsset,
            amount: fromAmount
          })
          
          const rateData = await ordersAPI.getExchangeRate({
            fromChain: fromChainId, // Send chainId instead of name
            fromAsset,
            toChain: toChainId, // Send chainId instead of name
            toAsset,
            amount: parseFloat(fromAmount),
            direction: 'forward'
          })
          console.log('[Swapper] Rate data received:', rateData)
          const estimatedTo = rateData.estimatedToAmount || rateData.estimatedAmount
          const estimatedToFormatted = estimatedTo && typeof estimatedTo === 'number' 
            ? estimatedTo.toFixed(6) 
            : (estimatedTo?.toString() || '0.0')
          console.log('[Swapper] Setting toAmount to:', estimatedToFormatted)
          setToAmount(estimatedToFormatted)
        } catch (error) {
          console.error('Error calculating rate:', error)
          setToAmount('')
          const errorMsg = error.response?.data?.error || error.message || 'Failed to calculate exchange rate'
          if (!errorMsg.includes('API key') && !errorMsg.includes('pair not available')) {
            toast.error(errorMsg, { duration: 4000 })
          }
        } finally {
          setCalculating(false)
        }
      } else {
        setToAmount('')
      }
    }

    debounceTimer.current = setTimeout(calculateRate, 500)
    
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [fromAmount, fromChain, fromAsset, toChain, toAsset])

  const handleMaxAmount = () => {
    if (walletBalance && parseFloat(walletBalance) > 0) {
      // Reserve small amount for gas - detect chain type dynamically
      const fromChainData = availableChains.find(c => c.value === fromChain)
      const isSolana = fromChainData && (
        (fromChainData.name || '').toLowerCase().includes('solana') ||
        (fromChainData.symbol || '').toUpperCase() === 'SOL'
      )
      const reserve = isSolana ? 0.001 : 0.01
      const maxAmount = Math.max(0, parseFloat(walletBalance) - reserve)
      setFromAmount(maxAmount.toFixed(6))
    }
  }

  const handleSwap = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast.error('Please enter an amount to swap')
      return
    }

    // Use connected wallet address as recipient (like Relay does)
    const finalRecipientAddress = recipientAddress.trim() || wallet?.address || ''
    
    if (!finalRecipientAddress) {
      toast.error('Please connect your wallet or enter a recipient address')
      return
    }

    // Validate recipient address for destination chain - detect dynamically
    const isSolana = toChainConfig && (
      (toChainConfig.name || '').toLowerCase().includes('solana') ||
      (toChainConfig.symbol || '').toUpperCase() === 'SOL' ||
      (toChainConfig.nativeCurrency?.symbol || '').toUpperCase() === 'SOL'
    )
    const isEVM = toChainConfig && !isSolana
    
    if (isEVM && !finalRecipientAddress.startsWith('0x')) {
      toast.error('Invalid EVM address. Must start with 0x')
      return
    }
    
    if (isSolana && finalRecipientAddress.length < 32) {
      toast.error('Invalid Solana address')
      return
    }

    setLoading(true)
    try {
      // Pure Relay wrapper - get quote/transaction from Relay
      const relayResponse = await ordersAPI.create({
        requestId: null, // Direct swap
        fromChain,
        fromAsset,
        toChain,
        toAsset,
        amount: parseFloat(fromAmount),
        recipientAddress: finalRecipientAddress,
        refundAddress: refundAddress || wallet?.address || null,
        userAddress: wallet?.address || null
      })

      // Relay returns either:
      // 1. Transaction data for direct execution (isDirectExecution: true)
      // 2. Deposit address for cross-chain swaps
      
      if (relayResponse.isDirectExecution && relayResponse.transactionData) {
        // Execute directly with wallet - pure Relay flow
        await executeRelayTransaction(relayResponse, wallet)
      } else if (relayResponse.depositAddress) {
        // Deposit address flow - Relay handles the rest
        setOrder(relayResponse)
        setOrderStatus('awaiting_deposit')
        setStatusPolling(true)
        toast.success('Swap quote created! Send funds to the deposit address.')
      } else {
        throw new Error('Invalid response from Relay')
      }
    } catch (error) {
      console.error('Error creating swap:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create swap order'
      toast.error(errorMessage, { duration: 5000 })
    } finally {
      setLoading(false)
    }
  }

  // Execute Relay transaction directly with wallet (like Relay does)
  const executeRelayTransaction = async (orderData, wallet) => {
    setExecuting(true)
    try {
      if (!wallet || !wallet.connected) {
        toast.error('Please connect your wallet to execute the swap')
        return
      }

      const { transactionData, approvalTransaction, fromChain, fromAsset } = orderData
      
      if (!transactionData) {
        throw new Error('No transaction data available. Please use deposit address method.')
      }
      
      // For EVM chains
      if (wallet.chain === 'evm' && window.ethereum) {
        const { ethers } = await import('ethers')
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()

        // Step 1: Approve token if needed (for ERC20)
        if (approvalTransaction && fromAsset !== 'ETH' && fromAsset !== 'BNB' && fromAsset !== 'MATIC') {
          toast.loading('Approving token...', { id: 'approval' })
          try {
            const approvalTx = await signer.sendTransaction(approvalTransaction)
            await approvalTx.wait()
            toast.success('Token approved!', { id: 'approval' })
          } catch (error) {
            toast.error('Token approval failed', { id: 'approval' })
            throw error
          }
        }

        // Step 2: Execute swap transaction
        toast.loading('Executing swap...', { id: 'swap' })
        try {
          const swapTx = await signer.sendTransaction(transactionData)
          toast.loading('Waiting for confirmation...', { id: 'swap' })
          
          const receipt = await swapTx.wait()
          toast.success('Swap transaction submitted!', { id: 'swap' })
          
          // Start polling for status
          setOrder({
            ...orderData,
            depositTxHash: receipt.hash
          })
          setOrderStatus('processing')
          setStatusPolling(true)
        } catch (error) {
          toast.error('Swap transaction failed', { id: 'swap' })
          throw error
        }
      }
      // For Solana
      else if (wallet.chain === 'solana' && (window.solana || window.solflare)) {
        const solanaProvider = window.solana || window.solflare
        toast.loading('Signing transaction...', { id: 'swap' })
        
        try {
          // Solana transaction signing
          const transaction = transactionData
          const signed = await solanaProvider.signTransaction(transaction)
          const signature = await solanaProvider.sendTransaction(signed, 'confirmed')
          
          toast.success('Swap transaction submitted!', { id: 'swap' })
          
          setOrder({
            ...orderData,
            depositTxHash: signature
          })
          setOrderStatus('processing')
          setStatusPolling(true)
        } catch (error) {
          toast.error('Transaction failed', { id: 'swap' })
          throw error
        }
      } else {
        throw new Error('Wallet not connected or unsupported chain')
      }
    } catch (error) {
      console.error('Error executing Relay transaction:', error)
      toast.error(error.message || 'Failed to execute swap')
    } finally {
      setExecuting(false)
    }
  }

  const handleSwitch = () => {
    // Switch from and to
    const tempChain = fromChain
    const tempAsset = fromAsset
    const tempAmount = fromAmount
    
    setFromChain(toChain)
    setFromAsset(toAsset)
    setFromAmount(toAmount)
    
    setToChain(tempChain)
    setToAsset(tempAsset)
    setToAmount(tempAmount)
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  // Poll order status if order exists and has exchangeId (like Relay does)
  useEffect(() => {
    if (!order || !order.exchangeId || statusPolling === false || orderStatus === 'completed' || orderStatus === 'failed') {
      return
    }

    const pollStatus = async () => {
      try {
        const response = await ordersAPI.getStatus(order.id)
        const newStatus = response.status || 'awaiting_deposit'
        setOrderStatus(newStatus)

        // Stop polling if completed or failed
        if (newStatus === 'completed' || newStatus === 'failed') {
          setStatusPolling(false)
          if (newStatus === 'completed') {
            toast.success('Swap completed! Tokens have been sent to your recipient address.')
          } else if (newStatus === 'failed') {
            toast.error('Swap failed. Please check the status or contact support.')
          }
        }
      } catch (error) {
        console.error('Error polling order status:', error)
        // Continue polling on error (might be transient)
      }
    }

    // Poll immediately, then every 10 seconds (like Relay)
    pollStatus()
    const interval = setInterval(pollStatus, 10000)

    return () => clearInterval(interval)
  }, [order, orderStatus, statusPolling])

  if (order) {
    // Check if this is a direct swap (no deposit address)
    // Use optional chaining and provide fallback to prevent undefined errors
    const isDirectSwap = Boolean(order?.isDirectSwap || (!order?.depositAddress && order?.depositAddress !== ''))
    
    return (
      <div className="max-w-4xl mx-auto">
        <Link to="/swap" className="inline-flex items-center gap-2 text-dark-400 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Swapper
        </Link>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-strong rounded-2xl p-6 bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-green-500/30"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-green-400 mb-2 tracking-tight">Swap Order Created!</h3>
            <p className="text-sm text-white/70 tracking-tight">
              {isDirectSwap 
                ? 'This is a same-chain swap. Execute it directly through your wallet.' 
                : `Send ${fromAsset} to the deposit address below`}
            </p>
          </div>

          {!isDirectSwap && order.depositAddress && (
            <>
              <div className="glass-strong rounded-2xl p-6 flex items-center justify-center mb-6 border border-white/[0.12]">
                <div className="w-64 h-64 bg-white rounded-2xl p-4 flex items-center justify-center shadow-soft-lg">
                  <QRCode 
                    value={order.depositAddress} 
                    size={224}
                    level="H"
                    includeMargin={false}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="glass-strong rounded-xl p-4 border border-white/[0.12]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/60 tracking-tight">Deposit Address</span>
                    <button
                      onClick={() => copyToClipboard(order.depositAddress)}
                      className="text-primary-400 hover:text-primary-300 flex items-center gap-2 transition-colors p-2 glass-strong rounded-lg border border-primary-500/30 hover:bg-primary-500/10"
                    >
                      <Copy className="w-4 h-4" />
                      <span className="text-xs tracking-tight">Copy</span>
                    </button>
                  </div>
                  <p className="font-mono text-sm break-all text-white/90 tracking-tight">{order.depositAddress}</p>
                </div>
              </div>
            </>
          )}
          
          {isDirectSwap && (
            <div className="space-y-4 mb-6">
              <div className="glass-strong rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/10">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-400 mb-1">Direct Swap Required</p>
                    <p className="text-xs text-white/70">
                      {order.message || 'This is a same-chain swap. Please execute it through a DEX like Uniswap, PancakeSwap, or 1inch using your wallet.'}
                    </p>
                  </div>
                </div>
              </div>
              
              {order.fromTokenAddress && order.toTokenAddress && (
                <div className="glass-strong rounded-xl p-4 border border-white/[0.12]">
                  <p className="text-xs text-white/60 mb-2">Swap Details</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/70">From Token:</span>
                      <span className="font-mono text-white/90 text-xs">{order.fromTokenAddress.substring(0, 20)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">To Token:</span>
                      <span className="font-mono text-white/90 text-xs">{order.toTokenAddress.substring(0, 20)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Amount:</span>
                      <span className="text-white/90">{fromAmount} {fromAsset}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="glass-strong rounded-xl p-4 border border-white/[0.12]">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/60">Sending</span>
              <span className="font-medium">{fromAmount} {fromAsset} on {fromChainConfig?.label}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Receiving</span>
              <span className="font-medium text-primary-400">{toAmount} {toAsset} on {toChainConfig?.label}</span>
            </div>
          </div>

          {!isDirectSwap && orderStatus && (
            <div className="glass-strong rounded-xl p-4 border border-white/[0.12] mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/60">Status</span>
                <span className={`text-sm font-medium ${
                  orderStatus === 'completed' ? 'text-green-400' :
                  orderStatus === 'processing' ? 'text-yellow-400' :
                  orderStatus === 'failed' ? 'text-red-400' :
                  'text-white/70'
                }`}>
                  {orderStatus === 'awaiting_deposit' && '⏳ Awaiting Deposit'}
                  {orderStatus === 'processing' && '🔄 Processing Swap'}
                  {orderStatus === 'completed' && '✅ Completed'}
                  {orderStatus === 'failed' && '❌ Failed'}
                </span>
              </div>
              {orderStatus === 'awaiting_deposit' && (
                <p className="text-xs text-white/60 mt-2">
                  Send {fromAmount} {fromAsset} to the deposit address above. Relay will automatically swap and send tokens to the recipient.
                </p>
              )}
              {orderStatus === 'processing' && (
                <p className="text-xs text-white/60 mt-2">
                  Deposit received! Relay is processing your swap. This may take a few minutes.
                </p>
              )}
              {orderStatus === 'completed' && (
                <p className="text-xs text-green-400 mt-2">
                  ✅ Swap completed! Tokens have been sent to the recipient address.
                </p>
              )}
            </div>
          )}

          {!isDirectSwap && (
            <button
              onClick={() => navigate(`/status/${order.id}`)}
              className="w-full px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl font-medium text-white hover:from-primary-600 hover:to-primary-700 transition-all flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View Full Status
            </button>
          )}
          
          {isDirectSwap && (
            <div className="space-y-3 mt-4">
              <p className="text-sm text-white/70 text-center">
                For same-chain swaps, please use a DEX aggregator:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://app.uniswap.org/#/swap?inputCurrency=${order?.fromTokenAddress || ''}&outputCurrency=${order?.toTokenAddress || ''}&chainId=${order?.chainId || ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/50 text-center text-sm text-white/90 hover:text-white transition-all"
                >
                  Uniswap
                </a>
                <a
                  href={`https://pancakeswap.finance/swap?inputCurrency=${order?.fromTokenAddress || ''}&outputCurrency=${order?.toTokenAddress || ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/50 text-center text-sm text-white/90 hover:text-white transition-all"
                >
                  PancakeSwap
                </a>
              </div>
            </div>
          )}
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-soft-lg shadow-purple-500/20">
            <RefreshCw className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">Token Swapper</h1>
            <p className="text-white/60 text-lg">Swap any cryptocurrency instantly</p>
          </div>
          {!wallet?.connected && (
            <button
              onClick={() => connectWallet('auto')}
              className="px-6 py-3 glass-strong rounded-xl border border-white/10 hover:border-purple-500/50 text-white font-medium flex items-center gap-2 transition-all"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
          )}
          {wallet?.connected && (
            <div className="px-4 py-2 glass-strong rounded-xl border border-green-500/30 bg-green-500/10 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm text-white/90 font-mono">{wallet.address?.substring(0, 6)}...{wallet.address?.substring(wallet.address.length - 4)}</span>
            </div>
          )}
        </div>

        {chainsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            <span className="ml-3 text-white/70">Loading chains...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* You Send */}
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80 tracking-tight">You send</label>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/60 mb-1.5 tracking-tight">Chain</label>
                    <select
                      value={fromChain || ''}
                      onChange={(e) => {
                        setFromChain(e.target.value)
                        setFromAsset(null) // Reset asset when chain changes
                      }}
                      className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-purple-500/50 focus:outline-none transition-all bg-white/[0.04] text-white text-sm"
                    >
                      <option value="">Select chain...</option>
                      {availableChains.map(chain => (
                        <option key={chain.value} value={chain.value} className="bg-black text-white">
                          {chain.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-white/60 mb-1.5 tracking-tight">Currency</label>
                    <select
                      value={fromAsset || ''}
                      onChange={(e) => setFromAsset(e.target.value)}
                      disabled={!fromChain || tokensLoading}
                      className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-purple-500/50 focus:outline-none transition-all bg-white/[0.04] text-white text-sm disabled:opacity-50"
                    >
                      <option value="">Select currency...</option>
                      {fromChainTokens.map(token => (
                        <option key={token.symbol} value={token.symbol} className="bg-black text-white">
                          {token.symbol} {token.isNative ? '(Native)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs text-white/60 tracking-tight">Amount</label>
                    {wallet?.connected && fromAsset && walletBalance && parseFloat(walletBalance) > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/50">Available: {walletBalance} {fromAsset}</span>
                        <button
                          onClick={handleMaxAmount}
                          className="px-2 py-1 glass-strong rounded-lg border border-white/10 hover:border-purple-500/50 text-xs text-white/70 hover:text-white transition-all flex items-center gap-1"
                        >
                          <Maximize2 className="w-3 h-3" />
                          MAX
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.000001"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 glass-strong rounded-xl border border-purple-500/30 focus:border-purple-500/50 focus:outline-none transition-all bg-purple-500/10 text-white placeholder:text-white/30 text-lg font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Switch Button */}
            <div className="flex items-center justify-center py-2">
              <button
                onClick={handleSwitch}
                className="p-3 glass-strong rounded-xl border border-white/10 hover:border-purple-500/50 transition-all"
              >
                <ArrowUpDown className="w-5 h-5 text-white/70" />
              </button>
            </div>

            {/* Floating rate indicator */}
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <RefreshCw className="w-4 h-4" />
                <span>Floating rate</span>
              </div>
            </div>

            {/* You Get */}
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80 tracking-tight">You get</label>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/60 mb-1.5 tracking-tight">Chain</label>
                    <select
                      value={toChain || ''}
                      onChange={(e) => {
                        setToChain(e.target.value)
                        setToAsset(null) // Reset asset when chain changes
                      }}
                      className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-green-500/50 focus:outline-none transition-all bg-white/[0.04] text-white text-sm"
                    >
                      <option value="">Select chain...</option>
                      {availableChains.map(chain => (
                        <option key={chain.value} value={chain.value} className="bg-black text-white">
                          {chain.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-white/60 mb-1.5 tracking-tight">Currency</label>
                    <select
                      value={toAsset || ''}
                      onChange={(e) => setToAsset(e.target.value)}
                      disabled={!toChain || tokensLoading}
                      className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-green-500/50 focus:outline-none transition-all bg-white/[0.04] text-white text-sm disabled:opacity-50"
                    >
                      <option value="">Select currency...</option>
                      {toChainTokens.map(token => (
                        <option key={token.symbol} value={token.symbol} className="bg-black text-white">
                          {token.symbol} {token.isNative ? '(Native)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1.5 tracking-tight">Estimated amount</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={toAmount || ''}
                      readOnly
                      placeholder={calculating ? "Calculating..." : "0.0"}
                      className="w-full px-4 py-3 glass-strong rounded-xl border border-green-500/30 focus:border-green-500/50 focus:outline-none transition-all bg-green-500/10 text-white placeholder:text-white/30 text-lg font-semibold"
                    />
                    {calculating && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-5 h-5 animate-spin text-green-400" />
                      </div>
                    )}
                  </div>
                  {calculating && (
                    <p className="text-xs text-green-400 mt-2 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Calculating exchange rate...
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Recipient Address - Hidden if wallet connected (like Relay) */}
            {!wallet?.connected && (
              <div>
                <label className="block text-sm font-medium mb-2 text-white/80 tracking-tight">Recipient Address</label>
                <input
                  type="text"
                  placeholder={toChainConfig && (toChainConfig.name || '').toLowerCase().includes('solana') ? 'Enter Solana address...' : '0x...'}
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-purple-500/50 focus:outline-none transition-all bg-white/[0.04] text-white placeholder:text-white/30 font-mono text-sm"
                />
                <p className="text-xs text-white/50 mt-2 tracking-tight">
                  Address where you want to receive {toAsset || 'tokens'} on {toChainConfig?.label || 'destination chain'}
                </p>
              </div>
            )}
            {wallet?.connected && (
              <div className="glass-strong rounded-xl p-4 border border-green-500/30 bg-green-500/10">
                <p className="text-sm text-green-400 mb-1">✓ Wallet Connected</p>
                <p className="text-xs text-white/70">Tokens will be sent to your connected wallet: {wallet.address?.substring(0, 8)}...{wallet.address?.substring(wallet.address.length - 6)}</p>
              </div>
            )}

            {/* Refund Address (Optional) */}
            {showRefund && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-white/80 tracking-tight">
                    Refund Address (Optional)
                  </label>
                  {wallet?.connected && (
                    <button
                      onClick={() => setRefundAddress(wallet.address)}
                      className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Use Wallet
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={refundAddress}
                  onChange={(e) => setRefundAddress(e.target.value)}
                  placeholder={fromChainConfig && (fromChainConfig.name || '').toLowerCase().includes('solana') ? 'Your refund address...' : '0x...'}
                  className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-purple-500/50 focus:outline-none transition-all bg-white/[0.04] text-white placeholder:text-white/30 font-mono text-sm"
                />
                <p className="text-xs text-white/50 mt-2 tracking-tight">
                  Address to refund if swap fails
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowRefund(!showRefund)}
                className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-all text-sm"
              >
                {showRefund ? 'Hide' : 'Add'} Refund Address
              </button>
            </div>

            <button
              onClick={handleSwap}
              disabled={loading || calculating || !fromAmount || !toAmount || !recipientAddress || !fromChain || !fromAsset || !toChain || !toAsset || parseFloat(fromAmount) <= 0}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-medium text-white hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Swap...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Create Swap
                </>
              )}
            </button>

            <div className="flex items-center gap-2 text-xs text-white/50">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>Powered by Relay Link • All chains & tokens supported • Direct to recipient</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default Swapper
