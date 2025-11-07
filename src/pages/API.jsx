import { useState } from 'react'
import { motion } from 'framer-motion'
import { Code, Copy, Check, ChevronRight } from 'lucide-react'
import { toast } from 'react-hot-toast'

const API = () => {
  const [copiedCode, setCopiedCode] = useState(null)
  const [expandedSection, setExpandedSection] = useState('overview')

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(id)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const baseUrl = 'https://api.blockpay.cloud/api'

  const endpoints = [
    {
      id: 'create-request',
      method: 'POST',
      path: '/requests',
      title: 'Create Payment Request',
      description: 'Create a new payment request',
      request: {
        body: {
          amount: 'string (required)',
          currency: 'string (required)',
          chain: 'string (required)',
          recipient: 'string (required)',
          description: 'string (optional)',
          refundAddress: 'string (optional)'
        },
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Protocol': 'blockx402/1.0 (optional)'
        }
      },
      response: {
        status: 201,
        body: {
          id: 'string',
          amount: 'string',
          currency: 'string',
          chain: 'string',
          recipient: 'string',
          description: 'string',
          status: 'pending',
          createdAt: 'string (ISO 8601)',
          expiresAt: 'string (ISO 8601)',
          payment_url: 'string'
        }
      },
      example: {
        request: `curl -X POST ${baseUrl}/requests \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "0.5",
    "currency": "ETH",
    "chain": "ethereum",
    "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "description": "Payment for services"
  }'`,
        response: `{
  "id": "req_1234567890_abc123",
  "amount": "0.5",
  "currency": "ETH",
  "chain": "ethereum",
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "description": "Payment for services",
  "status": "pending",
  "createdAt": "2024-01-01T10:00:00Z",
  "expiresAt": "2024-01-01T11:00:00Z",
  "payment_url": "https://blockpay.cloud/pay/req_1234567890_abc123"
}`
      }
    },
    {
      id: 'get-request',
      method: 'GET',
      path: '/requests/:id',
      title: 'Get Payment Request',
      description: 'Retrieve a payment request by ID',
      request: {
        params: {
          id: 'string (required)'
        }
      },
      response: {
        status: 200,
        body: {
          id: 'string',
          amount: 'string',
          currency: 'string',
          chain: 'string',
          recipient: 'string',
          description: 'string',
          status: 'string',
          createdAt: 'string',
          expiresAt: 'string',
          payment_url: 'string'
        }
      },
      example: {
        request: `curl ${baseUrl}/requests/req_1234567890_abc123`,
        response: `{
  "id": "req_1234567890_abc123",
  "amount": "0.5",
  "currency": "ETH",
  "chain": "ethereum",
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "description": "Payment for services",
  "status": "completed",
  "createdAt": "2024-01-01T10:00:00Z",
  "expiresAt": "2024-01-01T11:00:00Z",
  "payment_url": "https://blockpay.cloud/pay/req_1234567890_abc123"
}`
      }
    },
    {
      id: 'list-requests',
      method: 'GET',
      path: '/requests',
      title: 'List Payment Requests',
      description: 'Get all payment requests',
      response: {
        status: 200,
        body: 'array of payment request objects'
      },
      example: {
        request: `curl ${baseUrl}/requests`,
        response: `[
  {
    "id": "req_1234567890_abc123",
    "amount": "0.5",
    "currency": "ETH",
    "chain": "ethereum",
    "status": "pending",
    "createdAt": "2024-01-01T10:00:00Z"
  }
]`
      }
    },
    {
      id: 'create-order',
      method: 'POST',
      path: '/create-order',
      title: 'Create Swap Order',
      description: 'Create a cross-chain swap order',
      request: {
        body: {
          fromChain: 'string (required)',
          fromAsset: 'string (required)',
          amount: 'string (required)',
          toChain: 'string (optional)',
          toAsset: 'string (optional)',
          recipientAddress: 'string (optional)',
          refundAddress: 'string (optional)',
          requestId: 'string (optional)',
          userAddress: 'string (optional)'
        }
      },
      response: {
        status: 200,
        body: {
          id: 'string',
          depositAddress: 'string',
          exchangeId: 'string',
          estimatedAmount: 'number',
          exchangeRate: 'number',
          validUntil: 'string'
        }
      },
      example: {
        request: `curl -X POST ${baseUrl}/create-order \\
  -H "Content-Type: application/json" \\
  -d '{
    "fromChain": "ethereum",
    "fromAsset": "ETH",
    "amount": "0.1",
    "toChain": "binance",
    "toAsset": "BNB",
    "recipientAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }'`,
        response: `{
  "id": "order_1234567890_abc123",
  "depositAddress": "0x1234567890abcdef...",
  "exchangeId": "relay_12345",
  "estimatedAmount": 0.095,
  "exchangeRate": 0.95,
  "validUntil": "2024-01-01T11:00:00Z"
}`
      }
    },
    {
      id: 'order-status',
      method: 'GET',
      path: '/order-status/:id',
      title: 'Get Order Status',
      description: 'Get the status of a swap order',
      request: {
        params: {
          id: 'string (required)'
        }
      },
      response: {
        status: 200,
        body: {
          id: 'string',
          status: 'string',
          txHash: 'string',
          swapTxHash: 'string',
          amount: 'string',
          toAmount: 'string'
        }
      },
      example: {
        request: `curl ${baseUrl}/order-status/order_1234567890_abc123`,
        response: `{
  "id": "order_1234567890_abc123",
  "status": "completed",
  "txHash": "0x1234567890abcdef...",
  "swapTxHash": "0xabcdef1234567890...",
  "amount": "0.1",
  "toAmount": "0.095"
}`
      }
    }
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">API Documentation</h1>
        <p className="text-white/60 text-lg tracking-tight">
          Complete API reference for BlockPay Cloud
        </p>
      </motion.div>

      {/* Base URL */}
      <div className="glass rounded-2xl p-6 border border-white/[0.08]">
        <h2 className="text-xl font-semibold mb-3 tracking-tight">Base URL</h2>
        <code className="text-primary-400 font-mono text-lg">{baseUrl}</code>
      </div>

      {/* Authentication */}
      <div className="glass rounded-2xl p-6 border border-white/[0.08]">
        <h2 className="text-xl font-semibold mb-3 tracking-tight">Authentication</h2>
        <p className="text-white/80 mb-4">
          Most endpoints do not require authentication. For payment requests, include the 
          <code className="px-2 py-1 glass-strong rounded text-primary-400 text-sm mx-1">X-Payment-Protocol: blockx402/1.0</code>
          header to indicate protocol support.
        </p>
      </div>

      {/* Endpoints */}
      <div className="space-y-4">
        {endpoints.map((endpoint) => (
          <motion.div
            key={endpoint.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl border border-white/[0.08] overflow-hidden"
          >
            <button
              onClick={() => toggleSection(endpoint.id)}
              className="w-full p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded text-sm font-medium ${
                  endpoint.method === 'GET' ? 'bg-blue-500/20 text-blue-400' :
                  endpoint.method === 'POST' ? 'bg-green-500/20 text-green-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {endpoint.method}
                </span>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-white tracking-tight">{endpoint.title}</h3>
                  <p className="text-sm text-white/60 tracking-tight">{endpoint.description}</p>
                </div>
              </div>
              <ChevronRight
                className={`w-5 h-5 text-white/40 transition-transform ${
                  expandedSection === endpoint.id ? 'rotate-90' : ''
                }`}
              />
            </button>

            {expandedSection === endpoint.id && (
              <div className="p-6 border-t border-white/10 space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-white/60 mb-2 tracking-tight">Endpoint</h4>
                  <code className="text-primary-400 font-mono text-sm">{endpoint.path}</code>
                </div>

                {endpoint.request && (
                  <div>
                    <h4 className="text-sm font-medium text-white/60 mb-3 tracking-tight">Request</h4>
                    {endpoint.request.body && (
                      <div className="mb-4">
                        <p className="text-sm text-white/80 mb-2 tracking-tight">Body Parameters:</p>
                        <div className="space-y-2">
                          {Object.entries(endpoint.request.body).map(([key, value]) => (
                            <div key={key} className="flex items-start gap-3 text-sm">
                              <code className="text-primary-400 font-mono">{key}</code>
                              <span className="text-white/60">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {endpoint.request.headers && (
                      <div className="mb-4">
                        <p className="text-sm text-white/80 mb-2 tracking-tight">Headers:</p>
                        <div className="space-y-2">
                          {Object.entries(endpoint.request.headers).map(([key, value]) => (
                            <div key={key} className="flex items-start gap-3 text-sm">
                              <code className="text-primary-400 font-mono">{key}</code>
                              <span className="text-white/60">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-white/60 mb-3 tracking-tight">Response</h4>
                  {endpoint.response.body && (
                    <div className="mb-4">
                      <p className="text-sm text-white/80 mb-2 tracking-tight">Status: {endpoint.response.status}</p>
                      {typeof endpoint.response.body === 'string' ? (
                        <p className="text-sm text-white/60">{endpoint.response.body}</p>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(endpoint.response.body).map(([key, value]) => (
                            <div key={key} className="flex items-start gap-3 text-sm">
                              <code className="text-primary-400 font-mono">{key}</code>
                              <span className="text-white/60">{value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {endpoint.example && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-white/60 tracking-tight">Example Request</h4>
                        <button
                          onClick={() => copyToClipboard(endpoint.example.request, `${endpoint.id}-request`)}
                          className="p-1 glass-strong rounded border border-white/10 hover:border-primary-500/30 transition-all"
                        >
                          {copiedCode === `${endpoint.id}-request` ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-white/60" />
                          )}
                        </button>
                      </div>
                      <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
                        <code className="text-white/90">{endpoint.example.request}</code>
                      </pre>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-white/60 tracking-tight">Example Response</h4>
                        <button
                          onClick={() => copyToClipboard(endpoint.example.response, `${endpoint.id}-response`)}
                          className="p-1 glass-strong rounded border border-white/10 hover:border-primary-500/30 transition-all"
                        >
                          {copiedCode === `${endpoint.id}-response` ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-white/60" />
                          )}
                        </button>
                      </div>
                      <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
                        <code className="text-white/90">{endpoint.example.response}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Error Handling */}
      <div className="glass rounded-2xl p-6 border border-white/[0.08]">
        <h2 className="text-xl font-semibold mb-3 tracking-tight">Error Handling</h2>
        <p className="text-white/80 mb-4">
          All errors follow a consistent format:
        </p>
        <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
          <code className="text-white/90">{`{
  "error": "Error message description"
}`}</code>
        </pre>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-start gap-3">
            <code className="text-red-400 font-mono">400</code>
            <span className="text-white/60">Bad Request - Invalid parameters</span>
          </div>
          <div className="flex items-start gap-3">
            <code className="text-red-400 font-mono">404</code>
            <span className="text-white/60">Not Found - Resource does not exist</span>
          </div>
          <div className="flex items-start gap-3">
            <code className="text-red-400 font-mono">402</code>
            <span className="text-white/60">Payment Required - Payment needed to access resource</span>
          </div>
          <div className="flex items-start gap-3">
            <code className="text-red-400 font-mono">500</code>
            <span className="text-white/60">Internal Server Error - Server error occurred</span>
          </div>
        </div>
      </div>

      {/* Rate Limiting */}
      <div className="glass rounded-2xl p-6 border border-white/[0.08]">
        <h2 className="text-xl font-semibold mb-3 tracking-tight">Rate Limiting</h2>
        <p className="text-white/80">
          API requests are rate-limited to ensure fair usage. Current limits: 100 requests per minute per IP address.
        </p>
      </div>
    </div>
  )
}

export default API

