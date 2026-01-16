/**
 * Types for Playbook Templates
 */

import type { FlowStep } from '@/types/flow.types'

export interface VariableDefinition {
  name: string
  default_value: string
  required: boolean
  description: string
}

export interface PlaybookTemplate {
  template_id: string
  name: string
  description: string
  playbook_type: string

  flow_config: {
    steps: FlowStep[]
    version: string
    description: string
  }

  variable_definitions: VariableDefinition[]

  required_documents: {
    product: string[]
    competitor: string[]
    research: string[]
  }

  campaign_docs_guide: string
}
