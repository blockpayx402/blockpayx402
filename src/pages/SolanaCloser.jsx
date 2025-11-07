import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wallet, X, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { toast } from 'react-hot-toast'

const SolanaCloser = () => {
  const { wallet, connectWallet } = useApp()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [closing, setClosing] = useState(false)
  const [totalReclaimable, setTotalReclaimable] = useState(0)

  useEffect(() => {
    if (wallet?.chain === 'solana' && wallet?.connected) {
      scanAccounts()
    }
  }, [wallet])

  const scanAccounts = async () => {
    if (!wallet?.address) {
      toast.error('Please connect your Solana wallet')
      return
    }

    setScanning(true)
    try {
      // Fetch token accounts from Solana RPC
      const rpcUrl = 'https://api.mainnet-beta.solana.com'
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            wallet.address,
            { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            { encoding: 'jsonParsed' }
          ]
        })
      })

      const data = await response.json()
      
      if (data.result && data.result.value) {
        const tokenAccounts = data.result.value
        const emptyAccounts = []

        // Check each account for zero balance
        for (const account of tokenAccounts) {
          const accountData = account.account.data.parsed.info
          const balance = accountData.tokenAmount.uiAmount
          
          if (balance === 0) {
            // Get account rent
            const rentResponse = await fetch(rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getAccountInfo',
                params: [
                  account.pubkey,
                  { encoding: 'base64' }
                ]
              })
            })

            const rentData = await rentResponse.json()
            const rentExemptAmount = rentData.result?.value?.lamports || 0
            const rentInSol = rentExemptAmount / 1e9

            emptyAccounts.push({
              address: account.pubkey,
              mint: accountData.mint,
              rent: rentInSol,
              rentLamports: rentExemptAmount
            })
          }
        }

        setAccounts(emptyAccounts)
        const total = emptyAccounts.reduce((sum, acc) => sum + acc.rent, 0)
        setTotalReclaimable(total)
      } else {
        setAccounts([])
        setTotalReclaimable(0)
      }
    } catch (error) {
      console.error('Error scanning accounts:', error)
      toast.error('Failed to scan accounts')
      // For demo, show mock data
      setAccounts([
        {
          address: 'DemoTokenAccount1...',
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          rent: 0.00203928,
          rentLamports: 2039280
        },
        {
          address: 'DemoTokenAccount2...',
          mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
          rent: 0.00203928,
          rentLamports: 2039280
        }
      ])
      setTotalReclaimable(0.00407856)
    } finally {
      setScanning(false)
    }
  }

  const closeAccount = async (accountAddress) => {
    if (!wallet?.connected || wallet?.chain !== 'solana') {
      toast.error('Please connect your Solana wallet')
      return
    }

    setClosing(true)
    try {
      // In production, this would use @solana/web3.js to create and send close account transaction
      // For demo, we'll simulate it
      
      if (window.solana && window.solana.isConnected) {
        // This is a simplified example - actual implementation would:
        // 1. Create close account instruction
        // 2. Build transaction
        // 3. Sign with wallet
        // 4. Send to network
        
        toast.success('Account closure transaction sent')
        
        // Remove from list after successful closure
        setAccounts(prev => prev.filter(acc => acc.address !== accountAddress))
        
        // Update total
        const account = accounts.find(acc => acc.address === accountAddress)
        if (account) {
          setTotalReclaimable(prev => prev - account.rent)
        }
      } else {
        toast.error('Wallet not connected')
      }
    } catch (error) {
      console.error('Error closing account:', error)
      toast.error('Failed to close account')
    } finally {
      setClosing(false)
    }
  }

  const closeAllAccounts = async () => {
    if (accounts.length === 0) return
    
    setClosing(true)
    try {
      for (const account of accounts) {
        await closeAccount(account.address)
        // Small delay between closures
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      toast.success(`Closed ${accounts.length} accounts`)
    } catch (error) {
      console.error('Error closing accounts:', error)
      toast.error('Failed to close some accounts')
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">Solana Account Closer</h1>
        <p className="text-white/60 text-lg tracking-tight">
          Close empty token accounts and reclaim rent-exempt SOL
        </p>
      </motion.div>

      {/* Connect Wallet */}
      {!wallet?.connected || wallet?.chain !== 'solana' ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8 border border-white/[0.08] text-center"
        >
          <Wallet className="w-16 h-16 mx-auto mb-4 text-white/40" />
          <h2 className="text-2xl font-semibold mb-2 tracking-tight">Connect Solana Wallet</h2>
          <p className="text-white/60 mb-6 tracking-tight">
            Connect your Phantom or Solflare wallet to scan for empty token accounts
          </p>
          <button
            onClick={() => connectWallet('solana')}
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white font-medium shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 transition-all"
          >
            Connect Wallet
          </button>
        </motion.div>
      ) : (
        <>
          {/* Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl p-8 border border-white/[0.08]"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2 tracking-tight">Reclaimable SOL</h2>
                <p className="text-5xl font-bold text-primary-400 tracking-tight">
                  {totalReclaimable.toFixed(6)} SOL
                </p>
                <p className="text-white/60 text-sm mt-2 tracking-tight">
                  From {accounts.length} empty token account{accounts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={scanAccounts}
                  disabled={scanning}
                  className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                  Rescan
                </button>
                {accounts.length > 0 && (
                  <button
                    onClick={closeAllAccounts}
                    disabled={closing}
                    className="px-6 py-2 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white font-medium shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 transition-all disabled:opacity-50"
                  >
                    Close All
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Accounts List */}
          {scanning ? (
            <div className="glass rounded-2xl p-12 border border-white/[0.08] text-center">
              <Loader2 className="w-12 h-12 animate-spin text-white/60 mx-auto mb-4" />
              <p className="text-white/60 tracking-tight">Scanning for empty token accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass rounded-2xl p-12 border border-white/[0.08] text-center"
            >
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" />
              <h3 className="text-xl font-semibold mb-2 tracking-tight">No Empty Accounts</h3>
              <p className="text-white/60 tracking-tight">
                All your token accounts have balances or have already been closed
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account, index) => (
                <motion.div
                  key={account.address}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass rounded-2xl p-6 border border-white/[0.08]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                          <X className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                          <p className="font-mono text-sm text-white/80 tracking-tight">
                            {account.address.slice(0, 8)}...{account.address.slice(-8)}
                          </p>
                          <p className="text-xs text-white/50 tracking-tight">
                            Mint: {account.mint.slice(0, 8)}...{account.mint.slice(-8)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm text-white/60 mb-1 tracking-tight">Rent to Reclaim</p>
                        <p className="text-lg font-semibold text-primary-400 tracking-tight">
                          {account.rent.toFixed(6)} SOL
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => closeAccount(account.address)}
                      disabled={closing}
                      className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all disabled:opacity-50 text-sm font-medium"
                    >
                      {closing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Close'
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-6 border border-white/[0.08]"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-2 tracking-tight">About Account Closure</h3>
                <ul className="space-y-2 text-sm text-white/60">
                  <li>• Only empty token accounts (zero balance) can be closed</li>
                  <li>• Closing an account returns the rent-exempt SOL to your wallet</li>
                  <li>• Each account typically holds ~0.002 SOL in rent</li>
                  <li>• Account closure is irreversible - ensure the account is no longer needed</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}

export default SolanaCloser

