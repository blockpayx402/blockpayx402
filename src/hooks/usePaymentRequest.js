import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { toast } from 'react-hot-toast'

export const usePaymentRequest = () => {
  const { createPaymentRequest } = useApp()
  const [loading, setLoading] = useState(false)

  const validateForm = async (data) => {
    if (!data.amount || parseFloat(data.amount) <= 0) {
      toast.error('Please enter a valid amount')
      return false
    }

    if (!data.currency) {
      toast.error('Please select a currency')
      return false
    }

    const recipient = data.recipient || ''
    if (!recipient) {
      toast.error('Please enter a recipient address')
      return false
    }

    // Validate address based on chain
    try {
      const { validateAddress, validateAddressSync } = await import('../services/blockchain')
      
      if (data.chain === 'solana') {
        // Solana requires async validation
        const isValid = await validateAddress(recipient, 'solana')
        if (!isValid) {
          toast.error('Please enter a valid Solana address')
          return false
        }
      } else {
        // EVM chains can use sync validation
        if (!validateAddressSync(recipient, data.chain || 'ethereum')) {
          toast.error('Please enter a valid Ethereum/BNB/Polygon address')
          return false
        }
      }
    } catch (error) {
      console.error('Validation error:', error)
      // Fallback to basic validation
      if (data.chain === 'solana') {
        // Basic Solana address check
        if (recipient.length < 32 || recipient.length > 44) {
          toast.error('Please enter a valid Solana address')
          return false
        }
      } else {
        // EVM address check
        if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
          toast.error('Please enter a valid Ethereum/BNB/Polygon address')
          return false
        }
      }
    }

    return true
  }

  const handleCreate = async (formData) => {
    const isValid = await validateForm(formData)
    if (!isValid) {
      return null
    }

    setLoading(true)
    try {
      const request = createPaymentRequest({
        amount: formData.amount,
        chain: formData.chain || 'ethereum',
        currency: formData.currency,
        description: formData.description || 'Payment request',
        recipient: formData.recipient,
      })

      toast.success('Payment request created successfully!')
      return request
    } catch (error) {
      console.error('Error creating payment request:', error)
      toast.error('Failed to create payment request')
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    createRequest: handleCreate,
    loading,
  }
}

