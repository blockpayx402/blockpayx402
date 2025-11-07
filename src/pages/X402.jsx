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

  const curlGetRequest = `curl -H "X-Payment-Protocol: x402/1.0" \\
  https://blockpay.cloud/api/requests/<REQUEST_ID>`

  const curlWithPayment = `curl -H "X-Payment-Protocol: x402/1.0" \\
  -H "X-Payment: <base64_encoded_payment_payload>" \\
  https://blockpay.cloud/api/requests/<REQUEST_ID>`

  const curlCreateRequest = `curl -X POST https://blockpay.cloud/api/requests \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "1.5",
    "currency": "SOL",
    "chain": "solana",
    "recipient": "44kiGWWsSgdqPMvmqYgTS78Mx2BKCWzduATkfY4fnUta",
    "description": "Payment for services"
  }'`

  const exampleResponse = `HTTP/1.1 402 Payment Required
Content-Type: application/json
X-Payment-Protocol: x402/1.0

{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana-mainnet",
      "maxAmountRequired": "1500000000",
      "resource": "/api/requests/req_1234567890_abc123",
      "description": "Payment for services",
      "mimeType": "application/json",
      "payTo": "44kiGWWsSgdqPMvmqYgTS78Mx2BKCWzduATkfY4fnUta",
      "maxTimeoutSeconds": 300,
      "asset": "So11111111111111111111111111111111111111112",
      "extra": {
        "name": "Solana",
        "version": "1.0"
      }
    }
  ],
  "error": null
}`

  const jsExample = `// Step 1: Create payment request
const createResponse = await fetch('https://blockpay.cloud/api/requests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: '1.5',
    currency: 'SOL',
    chain: 'solana',
    recipient: '44kiGWWsSgdqPMvmqYgTS78Mx2BKCWzduATkfY4fnUta',
    description: 'Payment for services'
  })
})
const { id: requestId } = await createResponse.json()

// Step 2: Fetch resource with x402 protocol (will get 402 if payment required)
import { fetchWithX402 } from './services/x402'
const result = await fetchWithX402(\`/api/requests/\${requestId}\`)

if (result.paymentRequired) {
  // Step 2: Get payment requirements
  const { accepts } = result.paymentData
  const paymentReq = accepts[0] // Select first payment option
  
  // Step 3: Create and send Solana transaction
  const signature = await sendSolanaPayment(paymentReq)
  
  // Step 4: Create payment payload
  const paymentPayload = {
    x402Version: 1,
    scheme: paymentReq.scheme,
    network: paymentReq.network,
    payload: { signature }
  }
  
  // Step 5: Retry request with X-PAYMENT header
  const paymentHeader = btoa(JSON.stringify(paymentPayload))
  const paidResponse = await fetch('/api/requests/req_1234567890_abc123', {
    headers: {
      'X-Payment': paymentHeader,
      'X-Payment-Protocol': 'x402/1.0'
    }
  })
  
  const resource = await paidResponse.json()
}`

  const solanaWeb3Example = `import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js'

// Payment requirements from 402 response
const paymentReq = {
  scheme: 'exact',
  network: 'solana-mainnet',
  maxAmountRequired: '1500000000', // lamports (1.5 SOL)
  payTo: '44kiGWWsSgdqPMvmqYgTS78Mx2BKCWzduATkfY4fnUta'
}

// Connect to Solana
const connection = new Connection('https://api.mainnet-beta.solana.com')

// Create transfer transaction
const recipient = new PublicKey(paymentReq.payTo)
const amountLamports = BigInt(paymentReq.maxAmountRequired)

const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: recipient,
    lamports: Number(amountLamports)
  })
)

// Get recent blockhash
const { blockhash } = await connection.getLatestBlockhash()
transaction.recentBlockhash = blockhash
transaction.feePayer = wallet.publicKey

// Sign and send
const signedTx = await wallet.signTransaction(transaction)
const signature = await connection.sendRawTransaction(signedTx.serialize())

// Wait for confirmation
await connection.confirmTransaction(signature, 'confirmed')

// Create x402 payment payload
const paymentPayload = {
  x402Version: 1,
  scheme: paymentReq.scheme,
  network: paymentReq.network,
  payload: { signature }
}

// Encode as base64 for X-PAYMENT header
const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64')`

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">x402 Payment Protocol</h1>
        <p className="text-white/60 text-lg tracking-tight">
          Coinbase x402 protocol implementation for Solana. Built on HTTP 402 Payment Required.
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm text-white/40">
          <span>Based on</span>
          <a 
            href="https://github.com/coinbase/x402" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary-400 hover:text-primary-300 underline"
          >
            coinbase/x402
          </a>
        </div>
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
            <h3 className="text-lg font-semibold mb-3 text-white tracking-tight">Step 1: Create Payment Request</h3>
            <p className="text-white/60 text-sm mb-3">First, create a payment request to get a request ID:</p>
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
            <p className="text-white/40 text-xs mt-2">Response includes an <code className="text-primary-400">id</code> field - use this in the next step</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 text-white tracking-tight">Step 2: Get Payment Request (402 Response)</h3>
            <p className="text-white/60 text-sm mb-3">Use the request ID from step 1. Replace <code className="text-primary-400">&lt;REQUEST_ID&gt;</code> with your actual ID:</p>
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

          <div>
            <h3 className="text-lg font-semibold mb-3 text-white tracking-tight">Step 3: Access Resource with Payment</h3>
            <p className="text-white/60 text-sm mb-3">After sending payment, retry the request with the X-PAYMENT header:</p>
            <div className="relative">
              <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
                <code className="text-white/90">{curlWithPayment}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(curlWithPayment, 'curl-payment')}
                className="absolute top-2 right-2 p-2 glass-strong rounded-lg border border-white/10 hover:border-primary-500/30 transition-all"
              >
                {copiedCode === 'curl-payment' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-white/60" />
                )}
              </button>
            </div>
            <p className="text-white/40 text-xs mt-2">Replace <code className="text-primary-400">&lt;REQUEST_ID&gt;</code> and <code className="text-primary-400">&lt;base64_encoded_payment_payload&gt;</code> with actual values</p>
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
        <h2 className="text-2xl font-semibold mb-4 tracking-tight">x402 Protocol Flow</h2>
        <div className="space-y-4">
          <div className="p-4 glass-strong rounded-xl border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-primary-400 font-semibold">1. Request Resource</span>
            </div>
            <p className="text-white/60 text-sm">Client requests resource with X-Payment-Protocol header</p>
          </div>
          <div className="p-4 glass-strong rounded-xl border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-primary-400 font-semibold">2. 402 Response</span>
            </div>
            <p className="text-white/60 text-sm">Server responds with HTTP 402 and payment requirements</p>
          </div>
          <div className="p-4 glass-strong rounded-xl border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-primary-400 font-semibold">3. Send Payment</span>
            </div>
            <p className="text-white/60 text-sm">Client creates Solana transaction and sends to recipient</p>
          </div>
          <div className="p-4 glass-strong rounded-xl border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-primary-400 font-semibold">4. Verify & Settle</span>
            </div>
            <p className="text-white/60 text-sm">Client includes X-PAYMENT header with transaction signature</p>
          </div>
          <div className="p-4 glass-strong rounded-xl border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-primary-400 font-semibold">5. Access Resource</span>
            </div>
            <p className="text-white/60 text-sm">Server verifies payment and returns requested resource</p>
          </div>
        </div>

        <h2 className="text-2xl font-semibold mb-4 tracking-tight mt-8">API Endpoints</h2>
        <div className="space-y-4">
          <div className="p-4 glass-strong rounded-xl border border-white/10">
            <code className="text-primary-400 font-mono text-sm">POST /api/x402/verify</code>
            <p className="text-white/60 text-sm mt-1">Verify a payment payload</p>
          </div>
          <div className="p-4 glass-strong rounded-xl border border-white/10">
            <code className="text-primary-400 font-mono text-sm">POST /api/x402/settle</code>
            <p className="text-white/60 text-sm mt-1">Settle a payment (confirm on-chain)</p>
          </div>
          <div className="p-4 glass-strong rounded-xl border border-white/10">
            <code className="text-primary-400 font-mono text-sm">GET /api/x402/supported</code>
            <p className="text-white/60 text-sm mt-1">Get supported payment schemes and networks</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default X402
