'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  HistoricalArtifact,
  HistoricalSession,
  HistoricalDataFilter,
  ImportedDataReference,
  getCompatibleArtifactTypes,
} from './types'
import { ArtifactType } from '../ArtifactBrowser/types'

interface UseHistoricalDataOptions {
  projectId: string
  playbookType: string
  currentSessionId?: string
  stepId?: string
  enabled?: boolean
}

interface UseHistoricalDataReturn {
  artifacts: HistoricalArtifact[]
  sessions: HistoricalSession[]
  loading: boolean
  error: string | null
  filter: HistoricalDataFilter
  setFilter: (filter: Partial<HistoricalDataFilter>) => void
  filteredArtifacts: HistoricalArtifact[]
  availableTags: string[]
  availableStepIds: string[]
  refresh: () => Promise<void>
  getArtifactById: (id: string) => HistoricalArtifact | undefined
  importArtifact: (artifact: HistoricalArtifact) => ImportedDataReference
}

export function useHistoricalData({
  projectId,
  playbookType,
  currentSessionId,
  stepId,
  enabled = true,
}: UseHistoricalDataOptions): UseHistoricalDataReturn {
  const [artifacts, setArtifacts] = useState<HistoricalArtifact[]>([])
  const [sessions, setSessions] = useState<HistoricalSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [availableStepIds, setAvailableStepIds] = useState<string[]>([])

  const [filter, setFilterState] = useState<HistoricalDataFilter>({
    searchQuery: '',
    sessionName: '',
    dateFrom: null,
    dateTo: null,
    tags: [],
    stepIds: [],
    types: [],
    playbookType,
  })

  const setFilter = useCallback((update: Partial<HistoricalDataFilter>) => {
    setFilterState(prev => ({ ...prev, ...update }))
  }, [])

  // Get compatible artifact types for the current step
  const compatibleTypes = useMemo(() => {
    if (!stepId) return []
    return getCompatibleArtifactTypes(stepId)
  }, [stepId])

  // Fetch historical data
  const refresh = useCallback(async () => {
    if (!enabled || !projectId) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        project_id: projectId,
        limit: '50',
      })

      if (playbookType) {
        params.set('playbook_type', playbookType)
      }

      if (currentSessionId) {
        params.set('exclude_session_id', currentSessionId)
      }

      if (stepId && compatibleTypes.length > 0) {
        params.set('compatible_types', compatibleTypes.join(','))
      }

      if (filter.sessionName) {
        params.set('session_name', filter.sessionName)
      }

      if (filter.dateFrom) {
        params.set('date_from', filter.dateFrom)
      }

      if (filter.dateTo) {
        params.set('date_to', filter.dateTo)
      }

      if (filter.tags.length > 0) {
        params.set('tags', filter.tags.join(','))
      }

      const response = await fetch(`/api/playbook/historical-artifacts?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch historical data')
      }

      const data = await response.json()

      setArtifacts(data.artifacts || [])
      setSessions(data.sessions || [])
      setAvailableTags(data.filters?.availableTags || [])
      setAvailableStepIds(data.filters?.availableStepIds || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [enabled, projectId, playbookType, currentSessionId, stepId, compatibleTypes, filter.sessionName, filter.dateFrom, filter.dateTo, filter.tags])

  // Initial load
  useEffect(() => {
    if (enabled) {
      refresh()
    }
  }, [enabled, projectId, playbookType])

  // Filter artifacts locally
  const filteredArtifacts = useMemo(() => {
    let result = artifacts

    // Filter by search query
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase()
      result = result.filter(a =>
        a.name.toLowerCase().includes(query) ||
        a.stepName.toLowerCase().includes(query) ||
        (a.sessionName && a.sessionName.toLowerCase().includes(query)) ||
        (typeof a.content === 'string' && a.content.toLowerCase().includes(query))
      )
    }

    // Filter by session name
    if (filter.sessionName) {
      const name = filter.sessionName.toLowerCase()
      result = result.filter(a =>
        a.sessionName && a.sessionName.toLowerCase().includes(name)
      )
    }

    // Filter by date range
    if (filter.dateFrom) {
      const fromDate = new Date(filter.dateFrom)
      result = result.filter(a => new Date(a.createdAt) >= fromDate)
    }

    if (filter.dateTo) {
      const toDate = new Date(filter.dateTo)
      toDate.setDate(toDate.getDate() + 1)
      result = result.filter(a => new Date(a.createdAt) < toDate)
    }

    // Filter by tags
    if (filter.tags.length > 0) {
      result = result.filter(a =>
        a.tags && filter.tags.some(tag => a.tags?.includes(tag))
      )
    }

    // Filter by step IDs
    if (filter.stepIds.length > 0) {
      result = result.filter(a => filter.stepIds.includes(a.stepId))
    }

    // Filter by artifact types
    if (filter.types.length > 0) {
      result = result.filter(a => filter.types.includes(a.type as ArtifactType))
    }

    return result
  }, [artifacts, filter])

  // Get artifact by ID
  const getArtifactById = useCallback((id: string): HistoricalArtifact | undefined => {
    return artifacts.find(a => a.id === id)
  }, [artifacts])

  // Create import reference
  const importArtifact = useCallback((artifact: HistoricalArtifact): ImportedDataReference => {
    return {
      sourceSessionId: artifact.sessionId,
      sourceSessionName: artifact.sessionName,
      sourceStepId: artifact.stepId,
      sourceStepName: artifact.stepName,
      sourceArtifactId: artifact.id,
      importedAt: new Date().toISOString(),
      artifactType: artifact.type as ArtifactType,
    }
  }, [])

  return {
    artifacts,
    sessions,
    loading,
    error,
    filter,
    setFilter,
    filteredArtifacts,
    availableTags,
    availableStepIds,
    refresh,
    getArtifactById,
    importArtifact,
  }
}
