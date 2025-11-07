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

  const baseUrl = 'https://blockpay.cloud/api'

  // API Endpoints
  const endpoints = [
    {
      id: 'demo',
      method: 'GET',
      path: '/x402/demo',
      title: 'x402 Demo Endpoint',
      description: 'Test x402 protocol - returns 402 Payment Required with payment requirements',
      request: {
        headers: {
          'X-Payment-Protocol': 'x402/1.0 (required)'
        }
      },
      response: {
        status: '402 Payment Required',
        body: '{ x402Version: 1, accepts: [paymentRequirements], error: null }'
      },
      example: {
        bash: `curl -H "X-Payment-Protocol: x402/1.0" ${baseUrl}/x402/demo`,
        powershell: `try { $response = Invoke-WebRequest -Uri "${baseUrl}/x402/demo" -Headers @{"X-Payment-Protocol"="x402/1.0"}; $response.Content } catch { $stream = $_.Exception.Response.GetResponseStream(); $reader = New-Object System.IO.StreamReader($stream); $reader.ReadToEnd() }`,
        response: `{
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
    },
    {
      id: 'verify',
      method: 'POST',
      path: '/x402/verify',
      title: 'Verify Payment',
      description: 'Verify a payment payload with transaction signature',
      request: {
        body: {
          x402Version: 'number (required) - Protocol version, use 1',
          paymentHeader: 'string (required) - Base64 encoded payment payload',
          paymentRequirements: 'object (required) - Payment requirements from 402 response'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      },
      response: {
        status: '200 OK',
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
      "maxAmountRequired": "100000000",
      "payTo": "7FSRx9hk9GHcqJNRsG8B9oTLSZSohNB7TZc9pPio45Gn"
    }
  }'`,
        powershell: `Invoke-WebRequest -Uri "${baseUrl}/x402/verify" -Method POST \\
  -Headers @{"Content-Type"="application/json"} \\
  -Body '{
    "x402Version": 1,
    "paymentHeader": "<YOUR_BASE64_PAYMENT_PAYLOAD>",
    "paymentRequirements": {
      "scheme": "exact",
      "network": "solana-mainnet",
      "maxAmountRequired": "100000000",
      "payTo": "7FSRx9hk9GHcqJNRsG8B9oTLSZSohNB7TZc9pPio45Gn"
    }
  }'`,
        response: `{
  "isValid": true,
  "invalidReason": null
}`
      }
    },
    {
      id: 'settle',
      method: 'POST',
      path: '/x402/settle',
      title: 'Settle Payment',
      description: 'Settle a payment - confirm transaction is finalized on-chain',
      request: {
        body: {
          x402Version: 'number (required) - Protocol version, use 1',
          paymentHeader: 'string (required) - Base64 encoded payment payload',
          paymentRequirements: 'object (required) - Payment requirements from 402 response'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      },
      response: {
        status: '200 OK',
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
      "maxAmountRequired": "100000000",
      "payTo": "7FSRx9hk9GHcqJNRsG8B9oTLSZSohNB7TZc9pPio45Gn"
    }
  }'`,
        powershell: `Invoke-WebRequest -Uri "${baseUrl}/x402/settle" -Method POST \\
  -Headers @{"Content-Type"="application/json"} \\
  -Body '{
    "x402Version": 1,
    "paymentHeader": "<YOUR_BASE64_PAYMENT_PAYLOAD>",
    "paymentRequirements": {
      "scheme": "exact",
      "network": "solana-mainnet",
      "maxAmountRequired": "100000000",
      "payTo": "7FSRx9hk9GHcqJNRsG8B9oTLSZSohNB7TZc9pPio45Gn"
    }
  }'`,
        response: `{
  "success": true,
  "error": null,
  "txHash": "<YOUR_TX_HASH>",
  "networkId": "solana-mainnet"
}`
      }
    },
    {
      id: 'supported',
      method: 'GET',
      path: '/x402/supported',
      title: 'Get Supported Schemes',
      description: 'Get list of supported payment schemes and networks',
      request: {},
      response: {
        status: '200 OK',
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

      {/* Protocol Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8 border border-white/[0.08]"
      >
        <h2 className="text-2xl font-semibold mb-4 tracking-tight">What is x402?</h2>
        <div className="space-y-4 text-white/80 text-sm">
          <p>
            x402 is a payment protocol built on HTTP 402 Payment Required status code. It allows servers to request blockchain payments 
            before granting access to resources. The protocol is chain-agnostic and supports multiple payment schemes.
          </p>
          <p>
            <strong className="text-primary-400">How it works:</strong>
          </p>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Client requests a resource with <code className="text-primary-400">X-Payment-Protocol: x402/1.0</code> header</li>
            <li>Server responds with HTTP 402 and payment requirements (recipient, amount, network)</li>
            <li>Client sends blockchain payment to the specified address</li>
            <li>Client retries request with <code className="text-primary-400">X-PAYMENT</code> header containing transaction signature</li>
            <li>Server verifies payment on-chain and grants access to resource</li>
          </ol>
        </div>
      </motion.div>

      {/* API Endpoints */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <h2 className="text-2xl font-semibold mb-4 tracking-tight">API Endpoints</h2>
        {endpoints.map((endpoint) => (
          <div
            key={endpoint.id}
            className="glass rounded-2xl border border-white/[0.08] overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <span className={`px-3 py-1 rounded text-sm font-medium ${
                  endpoint.method === 'GET' ? 'bg-blue-500/20 text-blue-400' :
                  endpoint.method === 'POST' ? 'bg-green-500/20 text-green-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {endpoint.method}
                </span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white tracking-tight">{endpoint.title}</h3>
                  <p className="text-sm text-white/60 tracking-tight">{endpoint.description}</p>
                </div>
              </div>

              <div className="space-y-4">
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
                  <p className="text-sm text-white/80 mb-2 tracking-tight">Status: {endpoint.response.status}</p>
                  <p className="text-sm text-white/60">{endpoint.response.body}</p>
                  {endpoint.id === 'demo' && (
                    <div className="mt-3 p-3 glass-strong rounded-lg border border-primary-500/20">
                      <p className="text-white/60 text-xs mb-1 font-semibold">⚠️ Note for PowerShell users:</p>
                      <p className="text-white/40 text-xs">
                        The 402 status is <strong>expected</strong> - it means the endpoint is working correctly! 
                        PowerShell throws an error for 402, but the JSON response body is in the error. 
                        The PowerShell command above automatically extracts and displays it.
                      </p>
                    </div>
                  )}
                </div>

                {endpoint.example && (
                  <div className="space-y-4">
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
            </div>
          </div>
        ))}
      </motion.div>

      {/* Payment Payload Format */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-2xl p-8 border border-white/[0.08]"
      >
        <h2 className="text-2xl font-semibold mb-4 tracking-tight">Payment Payload Format</h2>
        <p className="text-white/80 mb-4 text-sm">
          After sending a Solana transaction, create a payment payload and encode it as base64 for the X-PAYMENT header:
        </p>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-white/60 mb-2">Payment Payload JSON:</h3>
            <pre className="p-4 glass-strong rounded-xl border border-white/10 overflow-x-auto text-sm">
              <code className="text-white/90">{`{
  "x402Version": 1,
  "scheme": "exact",
  "network": "solana-mainnet",
  "payload": {
    "signature": "<YOUR_TRANSACTION_SIGNATURE>"
  }
}`}</code>
            </pre>
          </div>
          <div>
            <h3 className="text-sm font-medium text-white/60 mb-2">Base64 Encode:</h3>
            <p className="text-white/60 text-sm mb-2">
              Encode the JSON payload as base64 and include in the <code className="text-primary-400">X-PAYMENT</code> header.
            </p>
            <p className="text-white/40 text-xs">
              JavaScript: <code className="text-primary-400">btoa(JSON.stringify(payload))</code><br/>
              Python: <code className="text-primary-400">base64.b64encode(json.dumps(payload).encode()).decode()</code><br/>
              PowerShell: <code className="text-primary-400">[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))</code>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Production Notes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-8 border border-white/[0.08]"
      >
        <h2 className="text-2xl font-semibold mb-4 tracking-tight">Production Ready</h2>
        <div className="space-y-3 text-white/80 text-sm">
          <div>
            <strong className="text-primary-400">✓ All endpoints are production-ready</strong>
            <p className="text-white/60 text-xs mt-1">Endpoints are deployed and accessible at https://blockpay.cloud/api</p>
          </div>
          <div>
            <strong className="text-primary-400">✓ On-chain verification</strong>
            <p className="text-white/60 text-xs mt-1">All payments are verified directly on Solana mainnet</p>
          </div>
          <div>
            <strong className="text-primary-400">✓ Error handling</strong>
            <p className="text-white/60 text-xs mt-1">Comprehensive error responses with clear messages</p>
          </div>
          <div>
            <strong className="text-primary-400">✓ Rate limiting</strong>
            <p className="text-white/60 text-xs mt-1">API requests are rate-limited to ensure fair usage</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default X402
