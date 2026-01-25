import { Inngest } from 'inngest'

// Create Inngest client
export const inngest = new Inngest({
  id: 'gattaca-secuenciador',
  name: 'Gattaca Secuenciador de Prompts',
})

// Event types for type safety
export type NicheFinderJobCreatedEvent = {
  name: 'niche-finder/job.created'
  data: {
    jobId: string
    sessionId?: string
    projectId: string
    userId: string
    config: {
      batch_size?: number
      serper_api_key?: string
      firecrawl_api_key?: string
      openrouter_api_key?: string
    }
  }
}

export type NicheFinderPhaseEvent = {
  name: 'niche-finder/phase.start'
  data: {
    jobId: string
    phase: 'serp' | 'scrape' | 'extract' | 'analyze'
  }
}

export type Events = {
  'niche-finder/job.created': NicheFinderJobCreatedEvent
  'niche-finder/phase.start': NicheFinderPhaseEvent
}
