// Netlify Function: Setup Status
import { checkSetup, generateSetupInstructions } from '../../server/utils/setup.js'

export const handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }

  try {
    const setupStatus = checkSetup()
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...setupStatus,
        instructions: generateSetupInstructions(setupStatus)
      })
    }
  } catch (error) {
    console.error('Error in setup function:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to check setup status' })
    }
  }
}

