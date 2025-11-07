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
      description: 'Create a new on-chain payment request',
      request: {
        body: {
          amount: 'string (required)',
          currency: 'string (required)',
          chain: 'string (required)',
          recipient: 'string (required)',
          description: 'string (optional)'
        },
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Protocol': 'x402/1.0 (optional)'
        }
      },
      response: {
        status: 201,
        body: '{ id, amount, currency, chain, recipient, description, status, createdAt, expiresAt, payment_url }'
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
      description: 'Retrieve the status of a payment request by ID. Returns 402 Payment Required if payment is pending and x402 protocol is requested.',
      request: {
        params: {
          id: 'string (required)'
        },
        headers: {
          'X-Payment-Protocol': 'x402/1.0 (optional - enables x402 protocol)',
          'X-Payment': 'base64 encoded payment payload (optional - for paid requests)'
        }
      },
      response: {
        status: '200 (success) or 402 (payment required)',
        body: 'Payment request object OR x402 payment requirements'
      },
      example: {
        request: `curl -H "X-Payment-Protocol: x402/1.0" ${baseUrl}/requests/req_1234567890_abc123`,
        response: `HTTP/1.1 402 Payment Required
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana-mainnet",
      "maxAmountRequired": "500000000",
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
      }
    },
    {
      id: 'list-requests',
      method: 'GET',
      path: '/requests',
      title: 'List Payment Requests',
      description: 'List all payment requests you have created',
      response: {
        status: 200,
        body: 'Array of payment request objects'
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
          Most endpoints do not require authentication. For x402 payment protocol support, include the 
          <code className="px-2 py-1 glass-strong rounded text-primary-400 text-sm mx-1">X-Payment-Protocol: x402/1.0</code>
          header to indicate protocol support. When accessing a payment request, you may receive a 402 Payment Required response with payment requirements.
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
                    {endpoint.request.params && (
                      <div className="mb-4">
                        <p className="text-sm text-white/80 mb-2 tracking-tight">Path Parameters:</p>
                        <div className="space-y-2">
                          {Object.entries(endpoint.request.params).map(([key, value]) => (
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
            <code className="text-yellow-400 font-mono">402</code>
            <span className="text-white/60">Payment Required - x402 protocol payment required</span>
          </div>
          <div className="flex items-start gap-3">
            <code className="text-red-400 font-mono">500</code>
            <span className="text-white/60">Internal Server Error - Server error occurred</span>
          </div>
        </div>
      </div>

      {/* x402 Protocol */}
      <div className="glass rounded-2xl p-6 border border-white/[0.08]">
        <h2 className="text-xl font-semibold mb-3 tracking-tight">x402 Payment Protocol</h2>
        <p className="text-white/80 mb-4">
          BlockPay implements the <a href="https://github.com/coinbase/x402" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300 underline">Coinbase x402</a> payment protocol for Solana payments. 
          This allows for HTTP 402 Payment Required responses with blockchain payment requirements.
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-primary-400 font-semibold">1.</span>
            <span className="text-white/60">Request resource with <code className="px-1 py-0.5 glass-strong rounded text-primary-400 text-xs">X-Payment-Protocol: x402/1.0</code> header</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-primary-400 font-semibold">2.</span>
            <span className="text-white/60">Receive HTTP 402 with payment requirements</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-primary-400 font-semibold">3.</span>
            <span className="text-white/60">Create and send Solana transaction</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-primary-400 font-semibold">4.</span>
            <span className="text-white/60">Retry request with <code className="px-1 py-0.5 glass-strong rounded text-primary-400 text-xs">X-PAYMENT</code> header containing transaction signature</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-primary-400 font-semibold">5.</span>
            <span className="text-white/60">Server verifies payment and returns resource</span>
          </div>
        </div>
        <div className="mt-4">
          <a 
            href="/x402" 
            className="text-primary-400 hover:text-primary-300 underline text-sm"
          >
            View full x402 documentation →
          </a>
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


