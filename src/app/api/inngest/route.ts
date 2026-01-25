import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { functions } from '@/lib/inngest/functions/niche-finder'

// Create and export the serve handler
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
})
