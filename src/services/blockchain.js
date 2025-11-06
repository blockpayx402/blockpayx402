import { ethers } from 'ethers'
import axios from 'axios'

// Lazy load Solana to avoid import issues
const getSolanaModules = async () => {
  try {
    const solana = await import('@solana/web3.js')
    return {
      Connection: solana.Connection,
      PublicKey: solana.PublicKey
    }
  } catch (error) {
    console.warn('Solana Web3.js not available:', error)
    return null
  }
}

// Blockchain configurations
export const CHAINS = {
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    decimals: 18,
    nativeCurrency: 'ETH'
  },
  bnb: {
    name: 'BNB Chain',
    symbol: 'BNB',
    // Use multiple RPC endpoints for better reliability and rate limit handling
    rpcUrl: 'https://bsc-dataseed.binance.org',
    rpcUrls: [
      'https://bsc-dataseed.binance.org',
      'https://bsc-dataseed1.binance.org',
      'https://bsc-dataseed2.binance.org',
      'https://bsc-dataseed3.binance.org',
      'https://rpc.ankr.com/bsc', // Alternative RPC
      'https://1rpc.io/bnb' // Another alternative
    ],
    explorerUrl: 'https://bscscan.com',
    decimals: 18,
    nativeCurrency: 'BNB'
  },
  polygon: {
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    decimals: 18,
    nativeCurrency: 'MATIC'
  },
  solana: {
    name: 'Solana',
    symbol: 'SOL',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://solscan.io',
    decimals: 9,
    nativeCurrency: 'SOL'
  }
}

// Token configurations
export const TOKENS = {
  ethereum: {
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, symbol: 'USDT' },
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, symbol: 'USDC' },
    DAI: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, symbol: 'DAI' }
  },
  bnb: {
    USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, symbol: 'USDT' },
    USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, symbol: 'USDC' },
    BUSD: { address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, symbol: 'BUSD' }
  },
  polygon: {
    USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, symbol: 'USDT' },
    USDC: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, symbol: 'USDC' }
  }
}

// Check recent transactions for EVM chains
export const checkRecentEVMTransactions = async (chain, recipientAddress, amount, currency = 'native', sinceTimestamp = null) => {
  const chainConfig = CHAINS[chain]
  if (!chainConfig) {
    return { verified: false, error: 'Unsupported chain' }
  }

  // Try multiple RPC endpoints if available (for rate limit handling)
  const rpcUrls = chainConfig.rpcUrls || [chainConfig.rpcUrl]
  let lastError = null
  
  for (let attempt = 0; attempt < rpcUrls.length; attempt++) {
    try {
      const rpcUrl = rpcUrls[attempt]
      console.log(`🔗 Attempting RPC endpoint ${attempt + 1}/${rpcUrls.length}: ${rpcUrl.substring(0, 30)}...`)
      
      // Wait before retrying (exponential backoff)
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // Max 5 seconds
        console.log(`⏳ Waiting ${delay}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
      // Create provider - ethers.js v6 constructor: JsonRpcProvider(url, network?, options?)
      const provider = new ethers.JsonRpcProvider(rpcUrl)

      const requiredAmount = parseFloat(amount) || 0
      const tolerance = Math.max(0.0001, requiredAmount * 0.01) // 1% tolerance or 0.0001, whichever is larger
    
      console.log(`💰 Verification parameters:`, {
        chain,
        recipientAddress,
        requiredAmount,
        currency,
        tolerance,
        sinceTimestamp: sinceTimestamp ? new Date(sinceTimestamp).toISOString() : null,
        rpcUrl
      })

      if (currency === 'native' || !currency) {
        // Check native token transactions
        // Get recent block number (last 1000 blocks = ~3-4 hours on Ethereum)
        const currentBlock = await provider.getBlockNumber().catch(err => {
          console.error('Error getting block number:', err)
          throw new Error('Failed to connect to blockchain RPC')
        })
        const startBlock = Math.max(0, currentBlock - 1000)
        
        console.log(`🔍 Checking blocks ${startBlock} to ${currentBlock} for ${recipientAddress}`)
        
        // Check last 100 blocks for recent transactions
        for (let blockNum = currentBlock; blockNum >= startBlock && blockNum > 0; blockNum -= 10) {
          try {
            const block = await provider.getBlock(blockNum, true)
            if (!block || !block.transactions) continue

            // Check if block was mined after request creation
            if (sinceTimestamp && block.timestamp * 1000 < sinceTimestamp) {
              break // Stop checking older blocks
            }

            for (const tx of block.transactions) {
              if (typeof tx === 'string') continue // Skip tx hashes, we need full tx objects
              
              // Check if transaction is to our recipient
              if (tx.to && tx.to.toLowerCase() === recipientAddress.toLowerCase()) {
                const value = parseFloat(ethers.formatEther(tx.value || 0))
                
                // Check if amount matches (within tolerance)
                if (value >= requiredAmount - tolerance) {
                  // Get transaction receipt to confirm it succeeded
                  const receipt = await provider.getTransactionReceipt(tx.hash).catch(() => null)
                  if (receipt && receipt.status === 1) {
                    return {
                      verified: true,
                      txHash: tx.hash,
                      amount: value,
                      from: tx.from,
                      to: tx.to,
                      blockNumber: blockNum,
                      timestamp: block.timestamp * 1000,
                      chain: chainConfig.name
                    }
                  }
                }
              }
            }
          } catch (blockError) {
            // Skip blocks that fail (might be reorged or unavailable)
            continue
          }
        }
      } else {
        // Check ERC-20 token transfers
        const token = TOKENS[chain]?.[currency]
        if (!token) {
          return { verified: false, error: `Token ${currency} not supported on ${chainConfig.name}` }
        }

        // Use Transfer event logs to find token transfers
        const tokenContract = new ethers.Contract(
          token.address,
          ['event Transfer(address indexed from, address indexed to, uint256 value)'],
          provider
        )

        // Get recent Transfer events to this address
        // Calculate precise block range based on request creation time to avoid rate limits
        const currentBlock = await provider.getBlockNumber()
        
        let startBlock = Math.max(0, currentBlock - 500) // Very conservative default
        
        if (sinceTimestamp) {
          // Calculate approximate block number when request was created
          // BNB Chain: ~3 seconds per block, Ethereum: ~12 seconds per block
          const avgBlockTime = chain === 'bnb' ? 3 : 12 // seconds
          const timeDiff = Date.now() - sinceTimestamp // milliseconds
          const blocksAgo = Math.ceil((timeDiff / 1000) / avgBlockTime)
          // Add 20% buffer for safety, but cap at reasonable limits
          const bufferBlocks = Math.min(Math.ceil(blocksAgo * 0.2), 100) // Max 100 block buffer
          const calculatedBlocks = blocksAgo + bufferBlocks
          
          // Cap the range to avoid rate limits - max 2000 blocks
          const maxBlocks = chain === 'bnb' ? 1500 : 1000
          const blocksToCheck = Math.min(calculatedBlocks, maxBlocks)
          
          startBlock = Math.max(0, currentBlock - blocksToCheck)
          
          console.log(`📅 Calculated block range:`, {
            requestCreated: new Date(sinceTimestamp).toISOString(),
            timeDiffMinutes: Math.floor(timeDiff / 60000),
            blocksAgo,
            bufferBlocks,
            blocksToCheck,
            startBlock,
            currentBlock,
            blockRange: currentBlock - startBlock,
            maxAllowed: maxBlocks
          })
        } else {
          // Fallback: use very small fixed range to avoid rate limits
          const blocksToCheck = chain === 'bnb' ? 500 : 300 // Very conservative
          startBlock = Math.max(0, currentBlock - blocksToCheck)
          console.log(`⚠️  No timestamp provided, using conservative range:`, {
            blocksToCheck,
            startBlock,
            currentBlock
          })
        }
        
        console.log(`🔍 Querying ${currency} transfers on ${chainConfig.name}:`, {
          tokenAddress: token.address,
          recipientAddress: recipientAddress.toLowerCase(),
          currentBlock,
          startBlock,
          blockRange: currentBlock - startBlock,
          requiredAmount,
          currency,
          rpcUrl
        })
        
        // Use lowercase for address comparison
        const filter = tokenContract.filters.Transfer(null, recipientAddress.toLowerCase())
        
        // Add delay before querying to avoid rate limits
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        console.log(`🔍 Querying with filter:`, {
          fromBlock: startBlock,
          toBlock: 'latest',
          recipient: recipientAddress.toLowerCase(),
          blockRange: currentBlock - startBlock
        })
        
        const events = await tokenContract.queryFilter(filter, startBlock, 'latest')
        
        console.log(`📊 Found ${events.length} Transfer events to ${recipientAddress}`)
        
        if (events.length === 0) {
          console.log(`⚠️  No ${currency} transfer events found. Checking if recipient address is correct...`)
          console.log(`   Token address: ${token.address}`)
          console.log(`   Recipient: ${recipientAddress}`)
        }

        for (const event of events) {
          // Check if event occurred after request creation
          if (sinceTimestamp && event.blockNumber) {
            const block = await provider.getBlock(event.blockNumber).catch(() => null)
            if (block && block.timestamp * 1000 < sinceTimestamp) {
              continue
            }
          }

          const value = parseFloat(ethers.formatUnits(event.args.value, token.decimals))
          
          // Normalize addresses for comparison (case-insensitive)
          const eventTo = event.args.to?.toLowerCase()
          const recipientLower = recipientAddress.toLowerCase()
          
          console.log(`🔍 Checking token transfer:`, {
            value,
            requiredAmount,
            tolerance,
            matches: value >= requiredAmount - tolerance,
            eventTo,
            recipientLower,
            addressesMatch: eventTo === recipientLower,
            event: event.transactionHash,
            blockNumber: event.blockNumber
          })
          
          // Verify recipient address matches (case-insensitive)
          if (eventTo !== recipientLower) {
            console.log(`⚠️  Address mismatch: event.to=${eventTo}, recipient=${recipientLower}`)
            continue
          }
          
          // Check if amount matches (within tolerance)
          if (value >= requiredAmount - tolerance) {
            // Get transaction to get hash
            const tx = await provider.getTransaction(event.transactionHash).catch(() => null)
            const receipt = await provider.getTransactionReceipt(event.transactionHash).catch(() => null)
            
            if (receipt && receipt.status === 1) {
              const block = await provider.getBlock(event.blockNumber).catch(() => null)
              return {
                verified: true,
                txHash: event.transactionHash,
                amount: value,
                from: event.args.from,
                to: event.args.to,
                blockNumber: event.blockNumber,
                timestamp: block ? block.timestamp * 1000 : Date.now(),
                chain: chainConfig.name,
                token: token.symbol
              }
            }
          }
        }
      }

      return { verified: false, reason: 'No matching transaction found' }
    } catch (error) {
      console.error(`❌ Error with RPC endpoint ${attempt + 1}:`, error.message || error)
      lastError = error
      
      // Check if it's a rate limit error
      const isRateLimit = error.message?.includes('rate limit') || 
                         error.message?.includes('rate limit') ||
                         error.code === 'BAD_DATA' ||
                         error.message?.includes('rate limit')
      
      if (isRateLimit && attempt < rpcUrls.length - 1) {
        console.log(`⚠️  Rate limit hit on endpoint ${attempt + 1}, trying next RPC endpoint...`)
        // Wait longer before trying next endpoint
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)))
        continue
      }
      
      // If this is the last endpoint, throw the error
      if (attempt === rpcUrls.length - 1) {
        throw error
      }
    }
  }
  
  // If we get here, all endpoints failed
  return { verified: false, error: lastError?.message || 'All RPC endpoints failed or rate limited' }
}

// Ethereum/BSC/Polygon verification - checks transaction history
export const verifyEVMTransaction = async (chain, recipientAddress, amount, currency = 'native', sinceTimestamp = null) => {
  try {
    const chainConfig = CHAINS[chain]
    if (!chainConfig) {
      return { verified: false, error: 'Unsupported chain' }
    }

    // Normalize address before validation
    const normalizedAddress = recipientAddress ? recipientAddress.trim().toLowerCase() : ''
    
    console.log('🔍 Validating address:', {
      original: recipientAddress,
      normalized: normalizedAddress,
      chain,
      length: normalizedAddress.length,
      isString: typeof recipientAddress === 'string'
    })

    if (!validateAddressSync(normalizedAddress, chain)) {
      console.error('❌ Address validation failed:', {
        address: normalizedAddress,
        chain,
        original: recipientAddress
      })
      return { verified: false, error: 'Invalid address format' }
    }

    // Use normalized address for verification
    return await checkRecentEVMTransactions(chain, normalizedAddress, amount, currency, sinceTimestamp)
  } catch (error) {
    console.error(`Error verifying ${chain} transaction:`, error)
    return { verified: false, error: error.message || 'Verification failed' }
  }
}

// Solana verification - checks transaction history
export const verifySolanaTransaction = async (recipientAddress, amount, currency = 'native', sinceTimestamp = null) => {
  try {
    const isValid = await validateAddress(recipientAddress, 'solana')
    if (!isValid) {
      return { verified: false, error: 'Invalid Solana address format' }
    }

    const solana = await getSolanaModules()
    if (!solana) {
      return { verified: false, error: 'Solana Web3.js not available' }
    }

    const connection = new solana.Connection(CHAINS.solana.rpcUrl, {
      commitment: 'confirmed',
      confirmTransaction: 5,
    })
    
    const publicKey = new solana.PublicKey(recipientAddress)
    const requiredAmount = parseFloat(amount) || 0
    const tolerance = 0.0001

    if (currency === 'native' || !currency || currency === 'SOL') {
      // Get recent signatures for this address (last 1000 transactions)
      try {
        const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 1000 })
        
        for (const sigInfo of signatures) {
          // Check if transaction occurred after request creation
          if (sinceTimestamp && sigInfo.blockTime && sigInfo.blockTime * 1000 < sinceTimestamp) {
            break // Stop checking older transactions
          }

          try {
            // Get transaction details
            const tx = await connection.getTransaction(sigInfo.signature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            })

            if (!tx || !tx.meta || tx.meta.err) continue // Skip failed transactions

            // Check if this transaction credited our address
            const preBalance = tx.meta.preBalances?.[tx.transaction.message.accountKeys.findIndex(k => k.equals(publicKey))] || 0
            const postBalance = tx.meta.postBalances?.[tx.transaction.message.accountKeys.findIndex(k => k.equals(publicKey))] || 0
            const balanceChange = (postBalance - preBalance) / Math.pow(10, 9) // Convert to SOL

            // Check if amount matches (within tolerance)
            if (balanceChange >= requiredAmount - tolerance) {
              return {
                verified: true,
                txHash: sigInfo.signature,
                amount: balanceChange,
                from: tx.transaction.message.accountKeys.find(k => !k.equals(publicKey))?.toString() || 'Unknown',
                to: recipientAddress,
                blockTime: sigInfo.blockTime ? sigInfo.blockTime * 1000 : Date.now(),
                chain: 'Solana'
              }
            }
          } catch (txError) {
            // Skip transactions that fail to fetch
            continue
          }
        }
      } catch (error) {
        console.error('Error fetching Solana signatures:', error)
      }

      return { verified: false, reason: 'No matching transaction found' }
    } else {
      // For SPL tokens, check token account transfers
      // This requires more complex implementation
      return {
        verified: false,
        error: 'SPL token verification not yet implemented'
      }
    }
  } catch (error) {
    console.error('Error verifying Solana transaction:', error)
    return { verified: false, error: error.message || 'Verification failed' }
  }
}

// Check transaction via blockchain explorer API
export const checkTransactionOnExplorer = async (chain, txHash) => {
  try {
    const chainConfig = CHAINS[chain]
    if (!chainConfig) return null

    // Using public explorer APIs (free tier)
    let apiUrl = ''
    
    if (chain === 'ethereum') {
      apiUrl = `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=YourApiKeyToken`
    } else if (chain === 'bnb') {
      apiUrl = `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=YourApiKeyToken`
    } else if (chain === 'polygon') {
      apiUrl = `https://api.polygonscan.com/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=YourApiKeyToken`
    }

    if (apiUrl) {
      const response = await axios.get(apiUrl)
      return response.data
    }
    
    return null
  } catch (error) {
    console.error('Error checking transaction:', error)
    return null
  }
}

// Main verification function - checks transaction history
export const verifyPayment = async (chain, recipientAddress, amount, currency = 'native', sinceTimestamp = null) => {
  try {
    if (chain === 'solana') {
      return await verifySolanaTransaction(recipientAddress, amount, currency, sinceTimestamp)
    } else {
      return await verifyEVMTransaction(chain, recipientAddress, amount, currency, sinceTimestamp)
    }
  } catch (error) {
    console.error('Payment verification error:', error)
    return { verified: false, error: error.message || 'Verification failed' }
  }
}

// Get available currencies for a chain
export const getChainCurrencies = (chain) => {
  const base = [CHAINS[chain]?.nativeCurrency || chain.toUpperCase()]
  const tokens = TOKENS[chain] ? Object.values(TOKENS[chain]).map(t => t.symbol) : []
  return [...base, ...tokens]
}

// Validate address format for chain
export const validateAddress = async (address, chain) => {
  if (!address || typeof address !== 'string') return false

  const trimmedAddress = address.trim()
  
  if (chain === 'solana') {
    try {
      // Solana addresses are base58 encoded, typically 32-44 characters
      if (trimmedAddress.length < 32 || trimmedAddress.length > 44) {
        return false
      }
      const solana = await getSolanaModules()
      if (!solana) return false
      new solana.PublicKey(trimmedAddress)
      return true
    } catch {
      return false
    }
  } else {
    // EVM chains (Ethereum, BNB, Polygon)
    // Check for 0x prefix and exactly 40 hex characters (42 total)
    return /^0x[a-fA-F0-9]{40}$/i.test(trimmedAddress)
  }
}

// Synchronous version for backward compatibility (returns promise for Solana)
export const validateAddressSync = (address, chain) => {
  if (chain === 'solana') {
    // For Solana, we need async validation
    return validateAddress(address, chain)
  }
  // For EVM chains, synchronous validation
  if (!address || typeof address !== 'string') {
    console.log('❌ Address validation failed: not a string', { address, type: typeof address })
    return false
  }
  const trimmedAddress = address.trim()
  // Normalize to lowercase for comparison (EVM addresses are case-insensitive)
  const normalizedAddress = trimmedAddress.toLowerCase()
  const isValid = /^0x[a-fA-F0-9]{40}$/i.test(trimmedAddress)
  
  if (!isValid) {
    console.log('❌ Address validation failed: invalid format', {
      address: trimmedAddress,
      length: trimmedAddress.length,
      startsWith0x: trimmedAddress.startsWith('0x'),
      hexPattern: /^0x[a-fA-F0-9]{40}$/i.test(trimmedAddress)
    })
  }
  
  return isValid
}

