import { useState } from 'react'
import { motion } from 'framer-motion'
import { Code, Copy, Check } from 'lucide-react'
import { toast } from 'react-hot-toast'

const X402 = () => {
  const [copiedCode, setCopiedCode] = useState(null)

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(id)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const curlCreateRequest = `curl -X POST https://api.blockpay.cloud/api/requests \\
  -H "Content-Type: application/json" \\
  -H "X-Payment-Protocol: blockx402/1.0" \\
  -d '{
    "amount": "1.5",
    "currency": "SOL",
    "chain": "solana",
    "recipient": "44kiGWWsSgdqPMvmqYgTS78Mx2BKCWzduATkfY4fnUta",
    "description": "Payment for services"
  }'`

  const curlGetRequest = `curl https://api.blockpay.cloud/api/requests/req_1234567890_abc123`

  const curlCheckStatus = `curl https://api.blockpay.cloud/api/requests/req_1234567890_abc123`

  const exampleResponse = `HTTP/1.1 402 Payment Required
Content-Type: application/json
X-Payment-Protocol: blockx402/1.0
X-Payment-Request-ID: req_1234567890_abc123

{
  "payment_required": true,
  "protocol": "blockx402",
  "version": "1.0",
  "request_id": "req_1234567890_abc123",
  "amount": "1.5",
  "currency": "SOL",
  "chain": "solana",
  "recipient": "44kiGWWsSgdqPMvmqYgTS78Mx2BKCWzduATkfY4fnUta",
  "description": "Payment for services",
  "expires_at": "2024-01-01T12:00:00Z",
  "payment_url": "https://blockpay.cloud/pay/req_1234567890_abc123"
}`

  const jsExample = `// Create Solana payment request
const response = await fetch('https://api.blockpay.cloud/api/requests', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Payment-Protocol': 'blockx402/1.0'
  },
  body: JSON.stringify({
    amount: '1.5',
    currency: 'SOL',
    chain: 'solana',
    recipient: '44kiGWWsSgdqPMvmqYgTS78Mx2BKCWzduATkfY4fnUta',
    description: 'Payment for services'
  })
})

const request = await response.json()
console.log('Payment URL:', request.payment_url)`

  const solanaWeb3Example = `import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js'
import { WalletAdapter } from '@solana/wallet-adapter-base'

// Connect to Solana
const connection = new Connection('https://api.mainnet-beta.solana.com')

// Payment details from 402 response
const recipient = new PublicKey('44kiGWWsSgdqPMvmqYgTS78Mx2BKCWzduATkfY4fnUta')
const amount = 1.5 // SOL

// Create transfer transaction
const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: recipient,
    lamports: amount * 1e9 // Convert SOL to lamports
  })
)

// Sign and send
const signature = await wallet.sendTransaction(transaction, connection)
await connection.confirmTransaction(signature)`

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">BlockX402 Protocol</h1>
        <p className="text-white/60 text-lg tracking-tight">
          HTTP 402 Payment Required implementation for Solana payments
        </p>
      </motion.div>

      {/* Quick Start - cURL Commands First */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-8 border border-white/[0.08]"
      >
        <h2 className="text-2xl font-semibold mb-6 tracking-tight">Quick Start - cURL Commands</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3 text-white tracking-tight">Create Payment Request</h3>
            <div className="relative">
              <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
                <code className="text-white/90">{curlCreateRequest}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(curlCreateRequest, 'curl-create')}
                className="absolute top-2 right-2 p-2 glass-strong rounded-lg border border-white/10 hover:border-primary-500/30 transition-all"
              >
                {copiedCode === 'curl-create' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-white/60" />
                )}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 text-white tracking-tight">Get Payment Request Status</h3>
            <div className="relative">
              <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
                <code className="text-white/90">{curlGetRequest}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(curlGetRequest, 'curl-get')}
                className="absolute top-2 right-2 p-2 glass-strong rounded-lg border border-white/10 hover:border-primary-500/30 transition-all"
              >
                {copiedCode === 'curl-get' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-white/60" />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* HTTP Response Format */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-8 border border-white/[0.08]"
      >
        <h2 className="text-2xl font-semibold mb-4 tracking-tight">HTTP 402 Response Format</h2>
        <p className="text-white/80 mb-4">
          When payment is required, the server responds with HTTP 402 and includes Solana payment details:
        </p>
        <div className="relative">
          <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
            <code className="text-white/90">{exampleResponse}</code>
          </pre>
          <button
            onClick={() => copyToClipboard(exampleResponse, 'response')}
            className="absolute top-2 right-2 p-2 glass-strong rounded-lg border border-white/10 hover:border-primary-500/30 transition-all"
          >
            {copiedCode === 'response' ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-white/60" />
            )}
          </button>
        </div>
      </motion.div>

      {/* Code Examples */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-6"
      >
        <div className="glass rounded-2xl p-8 border border-white/[0.08]">
          <h2 className="text-2xl font-semibold mb-4 tracking-tight">JavaScript Example</h2>
          <div className="relative">
            <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
              <code className="text-white/90">{jsExample}</code>
            </pre>
            <button
              onClick={() => copyToClipboard(jsExample, 'js')}
              className="absolute top-2 right-2 p-2 glass-strong rounded-lg border border-white/10 hover:border-primary-500/30 transition-all"
            >
              {copiedCode === 'js' ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-white/60" />
              )}
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl p-8 border border-white/[0.08]">
          <h2 className="text-2xl font-semibold mb-4 tracking-tight">Solana Web3.js Example</h2>
          <div className="relative">
            <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
              <code className="text-white/90">{solanaWeb3Example}</code>
            </pre>
            <button
              onClick={() => copyToClipboard(solanaWeb3Example, 'solana')}
              className="absolute top-2 right-2 p-2 glass-strong rounded-lg border border-white/10 hover:border-primary-500/30 transition-all"
            >
              {copiedCode === 'solana' ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-white/60" />
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Specification */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-8 border border-white/[0.08]"
      >
        <h2 className="text-2xl font-semibold mb-4 tracking-tight">Solana-Specific Fields</h2>
        <div className="space-y-4">
          <div className="p-4 glass-strong rounded-xl border border-white/10">
            <code className="text-primary-400 font-mono text-sm">chain</code>
            <p className="text-white/60 text-sm mt-1">Must be "solana" for Solana payments</p>
          </div>
          <div className="p-4 glass-strong rounded-xl border border-white/10">
            <code className="text-primary-400 font-mono text-sm">currency</code>
            <p className="text-white/60 text-sm mt-1">Must be "SOL" for Solana native token</p>
          </div>
          <div className="p-4 glass-strong rounded-xl border border-white/10">
            <code className="text-primary-400 font-mono text-sm">recipient</code>
            <p className="text-white/60 text-sm mt-1">Solana wallet address (base58 encoded, 32-44 characters)</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default X402
