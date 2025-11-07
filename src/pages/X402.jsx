import { useState } from 'react'
import { motion } from 'framer-motion'
import { Code, Copy, Check, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'react-hot-toast'

const X402 = () => {
  const [copiedCode, setCopiedCode] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(id)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const exampleRequest = `HTTP/1.1 402 Payment Required
Content-Type: application/json
X-Payment-Protocol: blockx402/1.0
X-Payment-Request-ID: req_1234567890_abc123

{
  "payment_required": true,
  "protocol": "blockx402",
  "version": "1.0",
  "request_id": "req_1234567890_abc123",
  "amount": "0.5",
  "currency": "ETH",
  "chain": "ethereum",
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "description": "Payment for services",
  "expires_at": "2024-01-01T12:00:00Z",
  "payment_url": "https://blockpay.cloud/pay/req_1234567890_abc123"
}`

  const exampleResponse = `HTTP/1.1 200 OK
Content-Type: application/json
X-Payment-Status: completed

{
  "status": "completed",
  "request_id": "req_1234567890_abc123",
  "transaction_hash": "0x1234567890abcdef...",
  "block_number": 12345678,
  "timestamp": "2024-01-01T11:30:00Z"
}`

  const curlExample = `curl -X POST https://api.blockpay.cloud/api/payment-requests \\
  -H "Content-Type: application/json" \\
  -H "X-Payment-Protocol: blockx402/1.0" \\
  -d '{
    "amount": "0.5",
    "currency": "ETH",
    "chain": "ethereum",
    "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "description": "Payment for services"
  }'`

  const jsExample = `// Create payment request
const response = await fetch('https://api.blockpay.cloud/api/payment-requests', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Payment-Protocol': 'blockx402/1.0'
  },
  body: JSON.stringify({
    amount: '0.5',
    currency: 'ETH',
    chain: 'ethereum',
    recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    description: 'Payment for services'
  })
})

const request = await response.json()
console.log('Payment URL:', request.payment_url)`

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
          HTTP 402 Payment Required implementation for blockchain payments
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 mb-6">
        {['overview', 'specification', 'examples', 'integration'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === tab
                ? 'border-primary-500 text-white'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="glass rounded-2xl p-8 border border-white/[0.08]">
            <h2 className="text-2xl font-semibold mb-4 tracking-tight">What is BlockX402?</h2>
            <p className="text-white/80 leading-relaxed mb-4">
              BlockX402 is an implementation of the HTTP 402 Payment Required status code, 
              extended for blockchain-based payments. It provides a standardized way to request 
              cryptocurrency payments through HTTP responses.
            </p>
            <p className="text-white/80 leading-relaxed mb-4">
              When a server needs payment before providing a resource, it responds with a 402 status 
              code containing payment details in a structured format. Clients can then process the 
              payment and retry the request.
            </p>
          </div>

          <div className="glass rounded-2xl p-8 border border-white/[0.08]">
            <h2 className="text-2xl font-semibold mb-4 tracking-tight">Key Features</h2>
            <ul className="space-y-3 text-white/80">
              <li className="flex items-start gap-3">
                <span className="text-primary-400 mt-1">•</span>
                <span>Standard HTTP 402 status code implementation</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary-400 mt-1">•</span>
                <span>Multi-chain support (Ethereum, BNB Chain, Polygon, Solana)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary-400 mt-1">•</span>
                <span>Automatic payment verification on blockchain</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary-400 mt-1">•</span>
                <span>Request expiration and status tracking</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary-400 mt-1">•</span>
                <span>RESTful API for payment request management</span>
              </li>
            </ul>
          </div>

          <div className="glass rounded-2xl p-8 border border-white/[0.08]">
            <h2 className="text-2xl font-semibold mb-4 tracking-tight">Protocol Version</h2>
            <p className="text-white/80 mb-2">
              Current version: <code className="px-2 py-1 glass-strong rounded text-primary-400">blockx402/1.0</code>
            </p>
            <p className="text-white/60 text-sm">
              Specify the protocol version in the X-Payment-Protocol header
            </p>
          </div>
        </motion.div>
      )}

      {/* Specification Tab */}
      {activeTab === 'specification' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="glass rounded-2xl p-8 border border-white/[0.08]">
            <h2 className="text-2xl font-semibold mb-4 tracking-tight">HTTP Response Format</h2>
            <p className="text-white/80 mb-4">
              When payment is required, the server responds with HTTP 402 and includes payment details:
            </p>
            <div className="relative">
              <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
                <code className="text-white/90">{exampleRequest}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(exampleRequest, 'request')}
                className="absolute top-2 right-2 p-2 glass-strong rounded-lg border border-white/10 hover:border-primary-500/30 transition-all"
              >
                {copiedCode === 'request' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-white/60" />
                )}
              </button>
            </div>
          </div>

          <div className="glass rounded-2xl p-8 border border-white/[0.08]">
            <h2 className="text-2xl font-semibold mb-4 tracking-tight">Response Headers</h2>
            <div className="space-y-3">
              <div className="p-4 glass-strong rounded-xl border border-white/10">
                <code className="text-primary-400 font-mono text-sm">X-Payment-Protocol</code>
                <p className="text-white/60 text-sm mt-1">Protocol identifier: blockx402/1.0</p>
              </div>
              <div className="p-4 glass-strong rounded-xl border border-white/10">
                <code className="text-primary-400 font-mono text-sm">X-Payment-Request-ID</code>
                <p className="text-white/60 text-sm mt-1">Unique identifier for the payment request</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-8 border border-white/[0.08]">
            <h2 className="text-2xl font-semibold mb-4 tracking-tight">Response Body Fields</h2>
            <div className="space-y-4">
              {[
                { field: 'payment_required', type: 'boolean', desc: 'Indicates payment is required' },
                { field: 'protocol', type: 'string', desc: 'Protocol identifier: blockx402' },
                { field: 'version', type: 'string', desc: 'Protocol version: 1.0' },
                { field: 'request_id', type: 'string', desc: 'Unique payment request identifier' },
                { field: 'amount', type: 'string', desc: 'Payment amount as string' },
                { field: 'currency', type: 'string', desc: 'Cryptocurrency symbol (ETH, USDT, etc.)' },
                { field: 'chain', type: 'string', desc: 'Blockchain network (ethereum, bnb, polygon, solana)' },
                { field: 'recipient', type: 'string', desc: 'Recipient wallet address' },
                { field: 'description', type: 'string', desc: 'Payment description' },
                { field: 'expires_at', type: 'string', desc: 'ISO 8601 expiration timestamp' },
                { field: 'payment_url', type: 'string', desc: 'URL to complete payment' },
              ].map((item) => (
                <div key={item.field} className="p-4 glass-strong rounded-xl border border-white/10">
                  <div className="flex items-center gap-3 mb-1">
                    <code className="text-primary-400 font-mono text-sm">{item.field}</code>
                    <span className="text-white/40 text-xs">({item.type})</span>
                  </div>
                  <p className="text-white/60 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-8 border border-white/[0.08]">
            <h2 className="text-2xl font-semibold mb-4 tracking-tight">Payment Completion</h2>
            <p className="text-white/80 mb-4">
              After payment is completed, the client should retry the original request. 
              The server will verify payment on-chain and respond with the requested resource:
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
          </div>
        </motion.div>
      )}

      {/* Examples Tab */}
      {activeTab === 'examples' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="glass rounded-2xl p-8 border border-white/[0.08]">
            <h2 className="text-2xl font-semibold mb-4 tracking-tight">cURL Example</h2>
            <div className="relative">
              <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
                <code className="text-white/90">{curlExample}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(curlExample, 'curl')}
                className="absolute top-2 right-2 p-2 glass-strong rounded-lg border border-white/10 hover:border-primary-500/30 transition-all"
              >
                {copiedCode === 'curl' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-white/60" />
                )}
              </button>
            </div>
          </div>

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
        </motion.div>
      )}

      {/* Integration Tab */}
      {activeTab === 'integration' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="glass rounded-2xl p-8 border border-white/[0.08]">
            <h2 className="text-2xl font-semibold mb-4 tracking-tight">Integration Steps</h2>
            <div className="space-y-4">
              <div className="p-4 glass-strong rounded-xl border border-white/10">
                <h3 className="font-semibold text-white mb-2">1. Handle 402 Response</h3>
                <p className="text-white/60 text-sm">
                  Check for HTTP 402 status code and parse payment details from response body
                </p>
              </div>
              <div className="p-4 glass-strong rounded-xl border border-white/10">
                <h3 className="font-semibold text-white mb-2">2. Display Payment Request</h3>
                <p className="text-white/60 text-sm">
                  Show payment amount, currency, and recipient address to user
                </p>
              </div>
              <div className="p-4 glass-strong rounded-xl border border-white/10">
                <h3 className="font-semibold text-white mb-2">3. Process Payment</h3>
                <p className="text-white/60 text-sm">
                  Use payment_url or initiate blockchain transaction to recipient address
                </p>
              </div>
              <div className="p-4 glass-strong rounded-xl border border-white/10">
                <h3 className="font-semibold text-white mb-2">4. Verify Payment</h3>
                <p className="text-white/60 text-sm">
                  Poll payment status endpoint or wait for blockchain confirmation
                </p>
              </div>
              <div className="p-4 glass-strong rounded-xl border border-white/10">
                <h3 className="font-semibold text-white mb-2">5. Retry Original Request</h3>
                <p className="text-white/60 text-sm">
                  Once payment is verified, retry the original request to receive the resource
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default X402

