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

  // Working example - no request needed, just curl the demo endpoint
  const curlDemo = `curl -H "X-Payment-Protocol: x402/1.0" \\
  https://blockpay.cloud/api/x402/demo`

  // After sending payment, retry with X-PAYMENT header
  // Replace <BASE64_PAYMENT_PAYLOAD> with your actual payment payload (see JavaScript example below)
  const curlWithPayment = `curl -H "X-Payment-Protocol: x402/1.0" \\
  -H "X-Payment: <BASE64_PAYMENT_PAYLOAD>" \\
  https://blockpay.cloud/api/x402/demo`

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

  const jsExample = `// Step 1: Request the demo endpoint (will return 402 Payment Required)
const response = await fetch('https://blockpay.cloud/api/x402/demo', {
  headers: {
    'X-Payment-Protocol': 'x402/1.0'
  }
})

// Step 2: Check if payment is required (status 402)
if (response.status === 402) {
  const paymentData = await response.json()
  const paymentReq = paymentData.accepts[0] // Get first payment requirement
  
  // Step 3: Send Solana payment using your wallet
  // You need to:
  // - Connect to Solana (use @solana/web3.js)
  // - Create a transfer transaction to paymentReq.payTo
  // - Amount: parseFloat(paymentReq.maxAmountRequired) / 1e9 (convert lamports to SOL)
  // - Sign and send the transaction
  // - Get the transaction signature
  
  // Example transaction creation (you need wallet connection):
  // const connection = new Connection('https://api.mainnet-beta.solana.com')
  // const recipient = new PublicKey(paymentReq.payTo)
  // const amountLamports = BigInt(paymentReq.maxAmountRequired)
  // const transaction = new Transaction().add(
  //   SystemProgram.transfer({
  //     fromPubkey: wallet.publicKey,
  //     toPubkey: recipient,
  //     lamports: Number(amountLamports)
  //   })
  // )
  // const signature = await wallet.sendTransaction(transaction, connection)
  // await connection.confirmTransaction(signature)
  
  // Step 4: Create payment payload with transaction signature
  // Replace 'YOUR_TX_SIGNATURE' with the actual signature from step 3
  const paymentPayload = {
    x402Version: 1,
    scheme: paymentReq.scheme,
    network: paymentReq.network,
    payload: {
      signature: 'YOUR_TX_SIGNATURE' // Replace with actual transaction signature
    }
  }
  
  // Step 5: Encode payment payload as base64
  const paymentHeader = btoa(JSON.stringify(paymentPayload))
  
  // Step 6: Retry request with X-PAYMENT header
  const paidResponse = await fetch('https://blockpay.cloud/api/x402/demo', {
    headers: {
      'X-Payment-Protocol': 'x402/1.0',
      'X-Payment': paymentHeader
    }
  })
  
  // Step 7: Get the resource (should be 200 OK now)
  const resource = await paidResponse.json()
  console.log('Payment verified!', resource)
}`

  const solanaWeb3Example = `import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js'

// Step 1: Get payment requirements from 402 response
// First, call the demo endpoint to get payment requirements
const response = await fetch('https://blockpay.cloud/api/x402/demo', {
  headers: { 'X-Payment-Protocol': 'x402/1.0' }
})
const paymentData = await response.json()
const paymentReq = paymentData.accepts[0] // Get first payment requirement

// Step 2: Connect to Solana (you need to have wallet connected)
// Make sure you have a wallet adapter or wallet object available
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed')

// Step 3: Parse payment requirements
const recipient = new PublicKey(paymentReq.payTo) // Address to send SOL to
const amountLamports = BigInt(paymentReq.maxAmountRequired) // Amount in lamports
// Convert to SOL: parseFloat(paymentReq.maxAmountRequired) / 1e9

// Step 4: Create transfer transaction
const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: wallet.publicKey, // Your wallet public key
    toPubkey: recipient,
    lamports: Number(amountLamports)
  })
)

// Step 5: Get recent blockhash and set fee payer
const { blockhash } = await connection.getLatestBlockhash()
transaction.recentBlockhash = blockhash
transaction.feePayer = wallet.publicKey

// Step 6: Sign transaction with your wallet
// This requires wallet connection (Phantom, Solflare, etc.)
const signedTx = await wallet.signTransaction(transaction)

// Step 7: Send transaction to Solana network
const signature = await connection.sendRawTransaction(signedTx.serialize())

// Step 8: Wait for confirmation (important!)
await connection.confirmTransaction(signature, 'confirmed')

// Step 9: Create x402 payment payload with the transaction signature
const paymentPayload = {
  x402Version: 1,
  scheme: paymentReq.scheme,
  network: paymentReq.network,
  payload: {
    signature: signature // Use the actual transaction signature from step 7
  }
}

// Step 10: Encode payment payload as base64 for X-PAYMENT header
const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64')

// Step 11: Retry the request with X-PAYMENT header
const paidResponse = await fetch('https://blockpay.cloud/api/x402/demo', {
  headers: {
    'X-Payment-Protocol': 'x402/1.0',
    'X-Payment': paymentHeader
  }
})

// Step 12: Get the verified resource
const result = await paidResponse.json()
console.log('Payment verified!', result)`

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
        <h2 className="text-2xl font-semibold mb-6 tracking-tight">Try It Now - Working Examples</h2>
        
        <div className="mb-6 p-4 glass-strong rounded-xl border border-primary-500/20 bg-primary-500/5">
          <p className="text-white/80 text-sm">
            <strong className="text-primary-400">No setup needed!</strong> The demo endpoint works immediately. 
            Just curl it to get a 402 response with payment requirements.
          </p>
        </div>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3 text-white tracking-tight">Step 1: Get Payment Requirements (402 Response)</h3>
            <p className="text-white/60 text-sm mb-3">This will return HTTP 402 with payment requirements. No request creation needed!</p>
            <div className="relative">
              <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
                <code className="text-white/90">{curlDemo}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(curlDemo, 'curl-demo')}
                className="absolute top-2 right-2 p-2 glass-strong rounded-lg border border-white/10 hover:border-primary-500/30 transition-all"
              >
                {copiedCode === 'curl-demo' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-white/60" />
                )}
              </button>
            </div>
            <p className="text-white/40 text-xs mt-2">
              This returns a 402 response with <code className="text-primary-400">accepts</code> array containing payment requirements.
              You'll see the recipient address and amount needed.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 text-white tracking-tight">Step 2: Send Payment & Retry with X-PAYMENT Header</h3>
            <p className="text-white/60 text-sm mb-3">
              After sending the Solana payment, create a payment payload and retry the request:
            </p>
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
            <p className="text-white/40 text-xs mt-2">
              Replace <code className="text-primary-400">&lt;BASE64_PAYMENT_PAYLOAD&gt;</code> with your actual payment payload.
              See the JavaScript/Solana examples below to see how to create it from a transaction signature.
            </p>
          </div>
        </div>
      </motion.div>

      {/* How It Works Explanation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass rounded-2xl p-8 border border-white/[0.08]"
      >
        <h2 className="text-2xl font-semibold mb-4 tracking-tight">How It Works</h2>
        <div className="space-y-4 text-white/80 text-sm">
          <div>
            <p className="mb-2">
              <strong className="text-primary-400">1. Request the demo endpoint</strong> - You'll get a 402 Payment Required response with payment requirements.
            </p>
            <p className="text-white/60 text-xs ml-4">
              The response includes: recipient address, amount (in lamports), network, and scheme.
            </p>
          </div>
          <div>
            <p className="mb-2">
              <strong className="text-primary-400">2. Send Solana payment</strong> - Create a Solana transaction sending the required amount to the recipient address.
            </p>
            <p className="text-white/60 text-xs ml-4">
              Use any Solana wallet (Phantom, Solflare, etc.) or @solana/web3.js to create and send the transaction.
            </p>
          </div>
          <div>
            <p className="mb-2">
              <strong className="text-primary-400">3. Create payment payload</strong> - Build a JSON object with the transaction signature.
            </p>
            <p className="text-white/60 text-xs ml-4">
              Format: <code className="text-primary-400">{"{ x402Version: 1, scheme: 'exact', network: 'solana-mainnet', payload: { signature: 'YOUR_TX_SIGNATURE' } }"}</code>
            </p>
          </div>
          <div>
            <p className="mb-2">
              <strong className="text-primary-400">4. Encode and retry</strong> - Base64 encode the payload and include it in the X-PAYMENT header.
            </p>
            <p className="text-white/60 text-xs ml-4">
              The server verifies the transaction on-chain and returns the resource if payment is valid.
            </p>
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
