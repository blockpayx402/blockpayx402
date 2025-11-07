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

  const baseUrl = 'https://blockpay.cloud/api'

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
        bash: `curl -X POST ${baseUrl}/requests \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "0.5",
    "currency": "ETH",
    "chain": "ethereum",
    "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "description": "Payment for services"
  }'`,
        powershell: `$body = @{
    amount = "0.5"
    currency = "ETH"
    chain = "ethereum"
    recipient = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    description = "Payment for services"
} | ConvertTo-Json

Invoke-WebRequest -Uri "${baseUrl}/requests" -Method POST -Headers @{"Content-Type"="application/json"} -Body $body`,
        response: `{
  "id": "<YOUR_REQUEST_ID>",
  "amount": "0.5",
  "currency": "ETH",
  "chain": "ethereum",
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "description": "Payment for services",
  "status": "pending",
  "createdAt": "2024-01-01T10:00:00Z",
  "expiresAt": "2024-01-01T11:00:00Z",
  "payment_url": "https://blockpay.cloud/pay/<YOUR_REQUEST_ID>"
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
        bash: `curl -H "X-Payment-Protocol: x402/1.0" ${baseUrl}/requests/<YOUR_REQUEST_ID>`,
        powershell: `Invoke-WebRequest -Uri "${baseUrl}/requests/<YOUR_REQUEST_ID>" -Headers @{"X-Payment-Protocol"="x402/1.0"}`,
        response: `HTTP/1.1 402 Payment Required
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana-mainnet",
      "maxAmountRequired": "500000000",
      "resource": "/api/requests/<YOUR_REQUEST_ID>",
      "description": "Payment for services",
      "mimeType": "application/json",
      "payTo": "<YOUR_PAYMENT_RECIPIENT_ADDRESS>",
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
      description: 'List all payment requests',
      response: {
        status: 200,
        body: 'Array of payment request objects'
      },
      example: {
        bash: `curl ${baseUrl}/requests`,
        powershell: `Invoke-WebRequest -Uri "${baseUrl}/requests"`,
        response: `[
  {
    "id": "<YOUR_REQUEST_ID>",
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
      id: 'update-request',
      method: 'PUT',
      path: '/requests/:id',
      title: 'Update Payment Request',
      description: 'Update payment request status',
      request: {
        params: {
          id: 'string (required)'
        },
        body: {
          status: 'string (optional) - pending, completed, expired',
          lastChecked: 'string (optional) - ISO timestamp'
        }
      },
      response: {
        status: 200,
        body: 'Updated payment request object'
      },
      example: {
        bash: `curl -X PUT ${baseUrl}/requests/<YOUR_REQUEST_ID> \\
  -H "Content-Type: application/json" \\
  -d '{"status": "completed"}'`,
        powershell: `$body = @{status = "completed"} | ConvertTo-Json
Invoke-WebRequest -Uri "${baseUrl}/requests/<YOUR_REQUEST_ID>" -Method PUT -Headers @{"Content-Type"="application/json"} -Body $body`,
        response: `{
  "id": "<YOUR_REQUEST_ID>",
  "status": "completed",
  "lastChecked": "2024-01-01T12:00:00Z"
}`
      }
    },
    {
      id: 'list-transactions',
      method: 'GET',
      path: '/transactions',
      title: 'List Transactions',
      description: 'Get all recorded transactions',
      response: {
        status: 200,
        body: 'Array of transaction objects'
      },
      example: {
        bash: `curl ${baseUrl}/transactions`,
        powershell: `Invoke-WebRequest -Uri "${baseUrl}/transactions"`,
        response: `[
  {
    "id": "<YOUR_TRANSACTION_ID>",
    "requestId": "<YOUR_REQUEST_ID>",
    "amount": "0.5",
    "currency": "ETH",
    "chain": "ethereum",
    "txHash": "<YOUR_TX_HASH>",
    "timestamp": "2024-01-01T12:00:00Z"
  }
]`
      }
    },
    {
      id: 'create-transaction',
      method: 'POST',
      path: '/transactions',
      title: 'Create Transaction',
      description: 'Record a new transaction',
      request: {
        body: {
          requestId: 'string (optional)',
          amount: 'string (required)',
          currency: 'string (required)',
          chain: 'string (required)',
          txHash: 'string (optional)',
          from: 'string (optional)',
          to: 'string (optional)'
        }
      },
      response: {
        status: 200,
        body: 'Created transaction object'
      },
      example: {
        bash: `curl -X POST ${baseUrl}/transactions \\
  -H "Content-Type: application/json" \\
  -d '{
    "requestId": "<YOUR_REQUEST_ID>",
    "amount": "0.5",
    "currency": "ETH",
    "chain": "ethereum",
    "txHash": "<YOUR_TX_HASH>"
  }'`,
        powershell: `$body = @{
    requestId = "<YOUR_REQUEST_ID>"
    amount = "0.5"
    currency = "ETH"
    chain = "ethereum"
    txHash = "<YOUR_TX_HASH>"
} | ConvertTo-Json

Invoke-WebRequest -Uri "${baseUrl}/transactions" -Method POST -Headers @{"Content-Type"="application/json"} -Body $body`,
        response: `{
  "id": "<YOUR_TRANSACTION_ID>",
  "requestId": "<YOUR_REQUEST_ID>",
  "amount": "0.5",
  "currency": "ETH",
  "chain": "ethereum",
  "txHash": "<YOUR_TX_HASH>",
  "timestamp": "2024-01-01T12:00:00Z"
}`
      }
    },
    {
      id: 'sync',
      method: 'POST',
      path: '/sync',
      title: 'Sync Data',
      description: 'Sync payment requests and transactions',
      request: {
        body: {
          requests: 'array (optional) - Array of payment request objects',
          transactions: 'array (optional) - Array of transaction objects'
        }
      },
      response: {
        status: 200,
        body: '{ success: boolean, requests: array, transactions: array }'
      },
      example: {
        bash: `curl -X POST ${baseUrl}/sync \\
  -H "Content-Type: application/json" \\
  -d '{
    "requests": [...],
    "transactions": [...]
  }'`,
        powershell: `$body = @{
    requests = @()
    transactions = @()
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "${baseUrl}/sync" -Method POST -Headers @{"Content-Type"="application/json"} -Body $body`,
        response: `{
  "success": true,
  "requests": [...],
  "transactions": [...]
}`
      }
    },
    {
      id: 'health',
      method: 'GET',
      path: '/health',
      title: 'Health Check',
      description: 'Check API health status',
      response: {
        status: 200,
        body: '{ status: "ok", timestamp: string }'
      },
      example: {
        bash: `curl ${baseUrl}/health`,
        powershell: `Invoke-WebRequest -Uri "${baseUrl}/health"`,
        response: `{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00Z"
}`
      }
    },
    {
      id: 'setup',
      method: 'GET',
      path: '/setup',
      title: 'Setup Status',
      description: 'Get system setup status and configuration',
      response: {
        status: 200,
        body: '{ ready: boolean, issues: array, warnings: array, instructions: object }'
      },
      example: {
        bash: `curl ${baseUrl}/setup`,
        powershell: `Invoke-WebRequest -Uri "${baseUrl}/setup"`,
        response: `{
  "ready": true,
  "issues": [],
  "warnings": [],
  "instructions": {...}
}`
      }
    },
    {
      id: 'cleanup',
      method: 'POST',
      path: '/cleanup',
      title: 'Cleanup Expired Requests',
      description: 'Delete expired payment requests',
      response: {
        status: 200,
        body: '{ success: boolean, deleted: number }'
      },
      example: {
        bash: `curl -X POST ${baseUrl}/cleanup`,
        powershell: `Invoke-WebRequest -Uri "${baseUrl}/cleanup" -Method POST`,
        response: `{
  "success": true,
  "deleted": 5
}`
      }
    },
    {
      id: 'x402-verify',
      method: 'POST',
      path: '/x402/verify',
      title: 'x402: Verify Payment',
      description: 'Verify a payment payload with the x402 facilitator',
      request: {
        body: {
          x402Version: 'number (required)',
          paymentHeader: 'string (required) - base64 encoded payment payload',
          paymentRequirements: 'object (required) - payment requirements from 402 response'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      },
      response: {
        status: 200,
        body: '{ isValid: boolean, invalidReason: string | null }'
      },
      example: {
        bash: `curl -X POST ${baseUrl}/x402/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "x402Version": 1,
    "paymentHeader": "<YOUR_BASE64_PAYMENT_PAYLOAD>",
    "paymentRequirements": {
      "scheme": "exact",
      "network": "solana-mainnet",
      "maxAmountRequired": "500000000",
      "payTo": "<YOUR_PAYMENT_RECIPIENT_ADDRESS>"
    }
  }'`,
        powershell: `$body = @{
    x402Version = 1
    paymentHeader = "<YOUR_BASE64_PAYMENT_PAYLOAD>"
    paymentRequirements = @{
        scheme = "exact"
        network = "solana-mainnet"
        maxAmountRequired = "500000000"
        payTo = "<YOUR_PAYMENT_RECIPIENT_ADDRESS>"
    }
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "${baseUrl}/x402/verify" -Method POST -Headers @{"Content-Type"="application/json"} -Body $body`,
        response: `{
  "isValid": true,
  "invalidReason": null
}`
      }
    },
    {
      id: 'x402-settle',
      method: 'POST',
      path: '/x402/settle',
      title: 'x402: Settle Payment',
      description: 'Settle a payment with the x402 facilitator (confirm on-chain)',
      request: {
        body: {
          x402Version: 'number (required)',
          paymentHeader: 'string (required) - base64 encoded payment payload',
          paymentRequirements: 'object (required) - payment requirements from 402 response'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      },
      response: {
        status: 200,
        body: '{ success: boolean, error: string | null, txHash: string | null, networkId: string | null }'
      },
      example: {
        bash: `curl -X POST ${baseUrl}/x402/settle \\
  -H "Content-Type: application/json" \\
  -d '{
    "x402Version": 1,
    "paymentHeader": "<YOUR_BASE64_PAYMENT_PAYLOAD>",
    "paymentRequirements": {
      "scheme": "exact",
      "network": "solana-mainnet",
      "maxAmountRequired": "500000000",
      "payTo": "<YOUR_PAYMENT_RECIPIENT_ADDRESS>"
    }
  }'`,
        powershell: `$body = @{
    x402Version = 1
    paymentHeader = "<YOUR_BASE64_PAYMENT_PAYLOAD>"
    paymentRequirements = @{
        scheme = "exact"
        network = "solana-mainnet"
        maxAmountRequired = "500000000"
        payTo = "<YOUR_PAYMENT_RECIPIENT_ADDRESS>"
    }
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "${baseUrl}/x402/settle" -Method POST -Headers @{"Content-Type"="application/json"} -Body $body`,
        response: `{
  "success": true,
  "error": null,
  "txHash": "<YOUR_TX_HASH>",
  "networkId": "solana-mainnet"
}`
      }
    },
    {
      id: 'x402-supported',
      method: 'GET',
      path: '/x402/supported',
      title: 'x402: Get Supported Schemes',
      description: 'Get list of supported payment schemes and networks',
      request: {},
      response: {
        status: 200,
        body: '{ kinds: [{ scheme: string, network: string }] }'
      },
      example: {
        bash: `curl ${baseUrl}/x402/supported`,
        powershell: `Invoke-WebRequest -Uri "${baseUrl}/x402/supported"`,
        response: `{
  "kinds": [
    {
      "scheme": "exact",
      "network": "solana-mainnet"
    },
    {
      "scheme": "exact",
      "network": "solana"
    }
  ]
}`
      }
    },
    {
      id: 'x402-demo',
      method: 'GET',
      path: '/x402/demo',
      title: 'x402: Demo Endpoint',
      description: 'Test x402 protocol - returns 402 Payment Required. No setup needed, works immediately.',
      request: {
        headers: {
          'X-Payment-Protocol': 'x402/1.0 (required)',
          'X-Payment': 'base64 encoded payment payload (optional - for paid requests)'
        }
      },
      response: {
        status: '402 Payment Required (without payment) or 200 OK (with valid payment)',
        body: 'x402 payment requirements OR success response'
      },
      example: {
        bash: `curl -H "X-Payment-Protocol: x402/1.0" ${baseUrl}/x402/demo`,
        powershell: `try { $response = Invoke-WebRequest -Uri "${baseUrl}/x402/demo" -Headers @{"X-Payment-Protocol"="x402/1.0"}; $response.Content } catch { $stream = $_.Exception.Response.GetResponseStream(); $reader = New-Object System.IO.StreamReader($stream); $reader.ReadToEnd() }`,
        response: `HTTP/1.1 402 Payment Required
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana-mainnet",
      "maxAmountRequired": "100000000",
      "resource": "/api/x402/demo",
      "description": "x402 Demo Payment - Send 0.1 SOL to test the protocol",
      "mimeType": "application/json",
      "payTo": "<YOUR_PAYMENT_RECIPIENT_ADDRESS>",
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
                    {endpoint.example.powershell && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-white/60 tracking-tight">Example Request (PowerShell)</h4>
                          <button
                            onClick={() => copyToClipboard(endpoint.example.powershell, `${endpoint.id}-powershell`)}
                            className="p-1 glass-strong rounded border border-white/10 hover:border-primary-500/30 transition-all"
                          >
                            {copiedCode === `${endpoint.id}-powershell` ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-white/60" />
                            )}
                          </button>
                        </div>
                        <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
                          <code className="text-white/90">{endpoint.example.powershell}</code>
                        </pre>
                      </div>
                    )}
                    {endpoint.example.bash && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-white/40 tracking-tight text-xs">Alternative: Bash/Linux/Mac (curl)</h4>
                          <button
                            onClick={() => copyToClipboard(endpoint.example.bash, `${endpoint.id}-bash`)}
                            className="p-1 glass-strong rounded border border-white/10 hover:border-primary-500/30 transition-all"
                          >
                            {copiedCode === `${endpoint.id}-bash` ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-white/60" />
                            )}
                          </button>
                        </div>
                        <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm opacity-60">
                          <code className="text-white/60">{endpoint.example.bash}</code>
                        </pre>
                      </div>
                    )}
                    {endpoint.example.request && !endpoint.example.powershell && !endpoint.example.bash && (
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
                    )}
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
        <p className="text-white/60 text-sm mb-4">
          All site functionality is accessible via API. The x402 protocol enables programmatic payment flows where servers can request blockchain payments before granting access to resources.
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-primary-400 font-semibold">1.</span>
            <span className="text-white/60">Request resource with <code className="px-1 py-0.5 glass-strong rounded text-primary-400 text-xs">X-Payment-Protocol: x402/1.0</code> header</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-primary-400 font-semibold">2.</span>
            <span className="text-white/60">Receive HTTP 402 with payment requirements (recipient, amount, network)</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-primary-400 font-semibold">3.</span>
            <span className="text-white/60">Send Solana payment to specified address</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-primary-400 font-semibold">4.</span>
            <span className="text-white/60">Retry request with <code className="px-1 py-0.5 glass-strong rounded text-primary-400 text-xs">X-PAYMENT</code> header containing base64-encoded payment payload</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-primary-400 font-semibold">5.</span>
            <span className="text-white/60">Server verifies payment on-chain and returns resource</span>
          </div>
        </div>
        <div className="mt-4 p-3 glass-strong rounded-lg border border-primary-500/20">
          <p className="text-white/80 text-sm">
            <strong className="text-primary-400">Production Ready:</strong> All x402 endpoints are live and verified on Solana mainnet. 
            Payments are verified on-chain in real-time.
          </p>
        </div>
        <div className="mt-4">
          <a 
            href="/x402" 
            className="text-primary-400 hover:text-primary-300 underline text-sm"
          >
            View full x402 API documentation →
          </a>
        </div>
      </div>

      {/* Rate Limiting */}
      <div className="glass rounded-2xl p-6 border border-white/[0.08]">
        <h2 className="text-xl font-semibold mb-3 tracking-tight">Rate Limiting</h2>
        <p className="text-white/80 mb-4">
          API requests are rate-limited to ensure fair usage. Current limits: 100 requests per minute per IP address.
        </p>
        <p className="text-white/60 text-sm">
          Rate limit headers are included in responses: <code className="text-primary-400">X-RateLimit-Limit</code>, 
          <code className="text-primary-400"> X-RateLimit-Remaining</code>, <code className="text-primary-400">X-RateLimit-Reset</code>
        </p>
      </div>

      {/* Production Status */}
      <div className="glass rounded-2xl p-6 border border-white/[0.08]">
        <h2 className="text-xl font-semibold mb-3 tracking-tight">Production Status</h2>
        <div className="space-y-3 text-white/80 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-green-400">✓</span>
            <div>
              <strong>All endpoints are production-ready</strong>
              <p className="text-white/60 text-xs mt-1">Deployed and accessible at https://blockpay.cloud/api</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-400">✓</span>
            <div>
              <strong>On-chain verification</strong>
              <p className="text-white/60 text-xs mt-1">All payments verified directly on Solana mainnet</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-400">✓</span>
            <div>
              <strong>Error handling</strong>
              <p className="text-white/60 text-xs mt-1">Comprehensive error responses with clear messages</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-400">✓</span>
            <div>
              <strong>Complete API coverage</strong>
              <p className="text-white/60 text-xs mt-1">All site functionality accessible via API endpoints</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default API


