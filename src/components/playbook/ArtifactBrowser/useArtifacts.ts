'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Artifact,
  ArtifactGroup,
  ArtifactType,
  ArtifactFilter,
  SessionArtifacts,
  ARTIFACT_TYPE_LABELS,
} from './types'

interface UseArtifactsOptions {
  sessionId?: string
  projectId: string
  campaignId?: string
  playbookType: string
  stepOutputs?: Record<string, unknown>
  allSteps?: Array<{
    definition: { id: string; name: string }
    state: { id: string; status: string; output?: unknown; input?: unknown }
  }>
}

interface UseArtifactsReturn {
  artifacts: SessionArtifacts | null
  loading: boolean
  error: string | null
  filter: ArtifactFilter
  setFilter: (filter: Partial<ArtifactFilter>) => void
  filteredGroups: ArtifactGroup[]
  refreshArtifacts: () => Promise<void>
  getArtifactById: (id: string) => Artifact | undefined
}

export function useArtifacts({
  sessionId,
  projectId,
  campaignId,
  playbookType,
  stepOutputs = {},
  allSteps = [],
}: UseArtifactsOptions): UseArtifactsReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<{
    steps: Array<{
      id: string
      step_id: string
      status: string
      input_data?: unknown
      output_data?: unknown
      started_at?: string
      completed_at?: string
    }>
    jobs: Array<{
      id: string
      status: string
      urls_found: number
      urls_scraped: number
      niches_extracted: number
    }>
  } | null>(null)

  const [filter, setFilterState] = useState<ArtifactFilter>({
    searchQuery: '',
    types: [],
    stepIds: [],
  })

  const setFilter = useCallback((update: Partial<ArtifactFilter>) => {
    setFilterState(prev => ({ ...prev, ...update }))
  }, [])

  // Load session data from API
  const refreshArtifacts = useCallback(async () => {
    if (!sessionId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/playbook/sessions/${sessionId}`)
      if (!response.ok) {
        throw new Error('Failed to load session data')
      }

      const data = await response.json()
      setSessionData({
        steps: data.steps || [],
        jobs: data.jobs || [],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) {
      refreshArtifacts()
    }
  }, [sessionId, refreshArtifacts])

  // Build artifacts from step outputs and session data
  const artifacts: SessionArtifacts | null = useMemo(() => {
    const allArtifacts: Artifact[] = []
    let artifactIndex = 0

    // Process step outputs from props (live data)
    allSteps.forEach((step, index) => {
      const stepDef = step.definition
      const stepState = step.state

      if (!stepState.output && !stepState.input) return

      // Process output
      if (stepState.output) {
        const output = stepState.output
        const artifact = createArtifactFromOutput(
          `artifact-${artifactIndex++}`,
          stepDef.id,
          stepDef.name,
          index + 1,
          output
        )
        if (artifact) {
          allArtifacts.push(artifact)
        }
      }

      // Process input if it's a complex object (like suggestions)
      if (stepState.input && typeof stepState.input === 'object') {
        const input = stepState.input as Record<string, unknown>
        if (input.suggestions || input.selected || input.items) {
          const artifact = createArtifactFromInput(
            `artifact-input-${artifactIndex++}`,
            stepDef.id,
            stepDef.name,
            index + 1,
            input
          )
          if (artifact) {
            allArtifacts.push(artifact)
          }
        }
      }
    })

    // Process session data from API
    if (sessionData?.steps) {
      sessionData.steps.forEach((step, index) => {
        if (!step.output_data) return

        // Skip if we already have this step from allSteps
        const existingArtifact = allArtifacts.find(a => a.stepId === step.step_id)
        if (existingArtifact) return

        const artifact = createArtifactFromOutput(
          `artifact-session-${artifactIndex++}`,
          step.step_id,
          step.step_id, // Use step_id as name since we don't have the definition
          index + 1,
          step.output_data
        )
        if (artifact) {
          artifact.createdAt = step.completed_at || step.started_at || new Date().toISOString()
          allArtifacts.push(artifact)
        }
      })
    }

    // Process jobs (SERP results, scraped content)
    if (sessionData?.jobs) {
      sessionData.jobs.forEach((job, index) => {
        if (job.urls_found > 0) {
          allArtifacts.push({
            id: `serp-${job.id}`,
            type: 'serp_results',
            name: `SERP Results - Job ${index + 1}`,
            stepId: 'serp-search',
            stepName: 'Search Results',
            stepOrder: 0,
            content: { jobId: job.id, count: job.urls_found },
            contentType: 'json',
            createdAt: new Date().toISOString(),
            itemCount: job.urls_found,
          })
        }

        if (job.urls_scraped > 0) {
          allArtifacts.push({
            id: `scraped-${job.id}`,
            type: 'scraped_content',
            name: `Scraped Content - Job ${index + 1}`,
            stepId: 'scraping',
            stepName: 'Scraped Pages',
            stepOrder: 1,
            content: { jobId: job.id, count: job.urls_scraped },
            contentType: 'json',
            createdAt: new Date().toISOString(),
            itemCount: job.urls_scraped,
          })
        }

        if (job.niches_extracted > 0) {
          allArtifacts.push({
            id: `extracted-${job.id}`,
            type: 'extracted_data',
            name: `Extracted Niches - Job ${index + 1}`,
            stepId: 'extraction',
            stepName: 'Extracted Data',
            stepOrder: 2,
            content: { jobId: job.id, count: job.niches_extracted },
            contentType: 'json',
            createdAt: new Date().toISOString(),
            itemCount: job.niches_extracted,
          })
        }
      })
    }

    // Group artifacts by type
    const groupsMap = new Map<ArtifactType, ArtifactGroup>()

    allArtifacts.forEach(artifact => {
      const existing = groupsMap.get(artifact.type)
      if (existing) {
        existing.artifacts.push(artifact)
        existing.count++
      } else {
        const typeInfo = ARTIFACT_TYPE_LABELS[artifact.type]
        groupsMap.set(artifact.type, {
          type: artifact.type,
          label: typeInfo.label,
          icon: typeInfo.icon,
          count: 1,
          artifacts: [artifact],
        })
      }
    })

    const groups = Array.from(groupsMap.values())

    return {
      sessionId: sessionId || '',
      projectId,
      campaignId,
      playbookType,
      groups,
      totalArtifacts: allArtifacts.length,
      totalSteps: allSteps.length,
      sessionStartedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    }
  }, [allSteps, sessionData, sessionId, projectId, campaignId, playbookType])

  // Filter groups
  const filteredGroups = useMemo(() => {
    if (!artifacts) return []

    return artifacts.groups
      .map(group => {
        // Filter by type
        if (filter.types.length > 0 && !filter.types.includes(group.type)) {
          return null
        }

        // Filter artifacts within group
        let filteredArtifacts = group.artifacts

        // Filter by step
        if (filter.stepIds.length > 0) {
          filteredArtifacts = filteredArtifacts.filter(a =>
            filter.stepIds.includes(a.stepId)
          )
        }

        // Filter by search query
        if (filter.searchQuery) {
          const query = filter.searchQuery.toLowerCase()
          filteredArtifacts = filteredArtifacts.filter(a =>
            a.name.toLowerCase().includes(query) ||
            a.stepName.toLowerCase().includes(query) ||
            (typeof a.content === 'string' && a.content.toLowerCase().includes(query))
          )
        }

        // Filter by saved only
        if (filter.savedOnly) {
          filteredArtifacts = filteredArtifacts.filter(a => a.savedToContextLake)
        }

        if (filteredArtifacts.length === 0) return null

        return {
          ...group,
          artifacts: filteredArtifacts,
          count: filteredArtifacts.length,
        }
      })
      .filter((g): g is ArtifactGroup => g !== null)
  }, [artifacts, filter])

  const getArtifactById = useCallback((id: string): Artifact | undefined => {
    if (!artifacts) return undefined

    for (const group of artifacts.groups) {
      const artifact = group.artifacts.find(a => a.id === id)
      if (artifact) return artifact
    }

    return undefined
  }, [artifacts])

  return {
    artifacts,
    loading,
    error,
    filter,
    setFilter,
    filteredGroups,
    refreshArtifacts,
    getArtifactById,
  }
}

// Helper functions

function createArtifactFromOutput(
  id: string,
  stepId: string,
  stepName: string,
  stepOrder: number,
  output: unknown
): Artifact | null {
  if (!output) return null

  const artifact: Artifact = {
    id,
    type: 'step_output',
    name: `${stepName} Output`,
    stepId,
    stepName,
    stepOrder,
    content: output,
    contentType: 'text',
    createdAt: new Date().toISOString(),
  }

  // Determine content type and artifact type
  if (typeof output === 'string') {
    artifact.contentType = output.includes('#') || output.includes('**') ? 'markdown' : 'text'
    artifact.wordCount = output.split(/\s+/).length
  } else if (Array.isArray(output)) {
    artifact.contentType = 'list'
    artifact.itemCount = output.length

    // Detect artifact type from array content
    if (output.length > 0) {
      const first = output[0]
      if (typeof first === 'object' && first !== null) {
        if ('url' in first) {
          artifact.type = 'serp_results'
          artifact.name = `${stepName} - URLs`
        } else if ('content' in first || 'text' in first) {
          artifact.type = 'scraped_content'
          artifact.name = `${stepName} - Content`
        } else if ('niche' in first || 'problem' in first || 'pain_point' in first) {
          artifact.type = 'extracted_data'
          artifact.name = `${stepName} - Extracted`
        }
        artifact.contentType = 'table'
      }
    }
  } else if (typeof output === 'object' && output !== null) {
    artifact.contentType = 'json'
    const obj = output as Record<string, unknown>

    // Detect artifact type from object keys
    if ('analysis' in obj || 'summary' in obj) {
      artifact.type = 'analysis'
      artifact.name = `${stepName} - Analysis`
    } else if ('suggestions' in obj || 'recommendations' in obj) {
      artifact.type = 'suggestions'
      artifact.name = `${stepName} - Suggestions`
    } else if ('generated' in obj || 'content' in obj) {
      artifact.type = 'generated_content'
      artifact.name = `${stepName} - Generated`
    }
  }

  return artifact
}

function createArtifactFromInput(
  id: string,
  stepId: string,
  stepName: string,
  stepOrder: number,
  input: Record<string, unknown>
): Artifact | null {
  if (!input) return null

  const artifact: Artifact = {
    id,
    type: 'decision',
    name: `${stepName} - Selection`,
    stepId,
    stepName,
    stepOrder,
    content: input,
    contentType: 'json',
    createdAt: new Date().toISOString(),
  }

  if (input.suggestions && Array.isArray(input.suggestions)) {
    artifact.type = 'suggestions'
    artifact.name = `${stepName} - Suggestions`
    artifact.itemCount = (input.suggestions as unknown[]).length
    artifact.contentType = 'list'
  } else if (input.selected && Array.isArray(input.selected)) {
    artifact.type = 'decision'
    artifact.name = `${stepName} - Selected Items`
    artifact.itemCount = (input.selected as unknown[]).length
    artifact.contentType = 'list'
  }

  return artifact
}
