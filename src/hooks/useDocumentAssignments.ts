'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  DocumentAssignment,
  FoundationalType,
  FoundationalSlot,
  SynthesisJob,
  Document,
  SynthesisResult,
  ValidateCompletenessResult,
  FOUNDATIONAL_TYPE_CONFIG,
} from '@/types/v2.types'
import { FOUNDATIONAL_TYPES } from '@/types/v2.types'

// Type for the API response
interface AssignmentsResponse {
  assignments: DocumentAssignment[]
  byType: Record<FoundationalType, DocumentAssignment[]>
  count: number
}

interface SynthesisStatusResponse {
  latestJob?: SynthesisJob
  needsResynthesis?: boolean
  sourceCount?: number
  jobs?: SynthesisJob[]
}

/**
 * Hook to manage document assignments and synthesis for foundational documents
 */
export function useDocumentAssignments(clientId: string) {
  const [assignments, setAssignments] = useState<DocumentAssignment[]>([])
  const [assignmentsByType, setAssignmentsByType] = useState<Record<FoundationalType, DocumentAssignment[]>>({} as Record<FoundationalType, DocumentAssignment[]>)
  const [synthesisJobs, setSynthesisJobs] = useState<Record<FoundationalType, SynthesisJob | null>>({} as Record<FoundationalType, SynthesisJob | null>)
  const [synthesizedDocs, setSynthesizedDocs] = useState<Record<FoundationalType, Document | null>>({} as Record<FoundationalType, Document | null>)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [synthesizing, setSynthesizing] = useState<FoundationalType | null>(null)

  // Load assignments
  const loadAssignments = useCallback(async () => {
    if (!clientId) return

    try {
      const response = await fetch(`/api/v2/assignments?clientId=${clientId}`)
      if (!response.ok) {
        throw new Error('Failed to load assignments')
      }

      const data: AssignmentsResponse = await response.json()
      setAssignments(data.assignments)
      setAssignmentsByType(data.byType || {})
    } catch (err) {
      console.error('Error loading assignments:', err)
      setError(err instanceof Error ? err.message : 'Failed to load assignments')
    }
  }, [clientId])

  // Load synthesis status for all types
  const loadSynthesisStatus = useCallback(async () => {
    if (!clientId) return

    const jobs: Record<FoundationalType, SynthesisJob | null> = {} as Record<FoundationalType, SynthesisJob | null>
    const docs: Record<FoundationalType, Document | null> = {} as Record<FoundationalType, Document | null>

    for (const type of FOUNDATIONAL_TYPES) {
      try {
        const response = await fetch(
          `/api/v2/synthesis?clientId=${clientId}&foundationalType=${type}`
        )
        if (response.ok) {
          const data: SynthesisStatusResponse = await response.json()
          jobs[type] = data.latestJob || null
          docs[type] = data.latestJob?.synthesized_document as Document | null || null
        } else {
          jobs[type] = null
          docs[type] = null
        }
      } catch {
        jobs[type] = null
        docs[type] = null
      }
    }

    setSynthesisJobs(jobs)
    setSynthesizedDocs(docs)
  }, [clientId])

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([loadAssignments(), loadSynthesisStatus()])
      setLoading(false)
    }
    load()
  }, [loadAssignments, loadSynthesisStatus])

  // Reload all data
  const reload = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadAssignments(), loadSynthesisStatus()])
    setLoading(false)
  }, [loadAssignments, loadSynthesisStatus])

  // Assign a document to a foundational type
  const assignDocument = useCallback(async (
    sourceDocumentId: string,
    targetType: FoundationalType,
    options?: { weight?: number; notes?: string }
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/v2/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          sourceDocumentId,
          targetFoundationalType: targetType,
          weight: options?.weight || 1.0,
          notes: options?.notes,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign document')
      }

      await loadAssignments()
      return true
    } catch (err) {
      console.error('Error assigning document:', err)
      setError(err instanceof Error ? err.message : 'Failed to assign document')
      return false
    }
  }, [clientId, loadAssignments])

  // Remove an assignment
  const unassignDocument = useCallback(async (assignmentId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/v2/assignments/${assignmentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove assignment')
      }

      await loadAssignments()
      return true
    } catch (err) {
      console.error('Error removing assignment:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove assignment')
      return false
    }
  }, [loadAssignments])

  // Update assignment (weight, order, notes)
  const updateAssignment = useCallback(async (
    assignmentId: string,
    updates: { weight?: number; display_order?: number; notes?: string }
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/v2/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update assignment')
      }

      await loadAssignments()
      return true
    } catch (err) {
      console.error('Error updating assignment:', err)
      setError(err instanceof Error ? err.message : 'Failed to update assignment')
      return false
    }
  }, [loadAssignments])

  // Trigger synthesis for a foundational type
  const synthesize = useCallback(async (
    foundationalType: FoundationalType,
    force: boolean = false
  ): Promise<SynthesisResult> => {
    setSynthesizing(foundationalType)

    try {
      const response = await fetch('/api/v2/synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          foundationalType,
          force,
        }),
      })

      const result: SynthesisResult = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Synthesis failed')
      }

      // Reload to get updated status
      await loadSynthesisStatus()

      return result
    } catch (err) {
      console.error('Error synthesizing:', err)
      const errorMessage = err instanceof Error ? err.message : 'Synthesis failed'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setSynthesizing(null)
    }
  }, [clientId, loadSynthesisStatus])

  // Validate completeness of a synthesized document
  const validateCompleteness = useCallback(async (
    documentId: string,
    foundationalType: FoundationalType
  ): Promise<ValidateCompletenessResult | null> => {
    try {
      const response = await fetch('/api/v2/synthesis/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, foundationalType }),
      })

      if (!response.ok) {
        throw new Error('Validation failed')
      }

      return await response.json()
    } catch (err) {
      console.error('Error validating:', err)
      return null
    }
  }, [])

  // Build foundational slots with all status info
  const slots = useMemo((): FoundationalSlot[] => {
    return FOUNDATIONAL_TYPES.map(type => {
      const typeAssignments = assignmentsByType[type] || []
      const latestJob = synthesisJobs[type]
      const synthesizedDoc = synthesizedDocs[type]

      // Check if resynthesis is needed
      // This is a simple check - the API provides a more accurate one
      const needsResynthesis = Boolean(
        typeAssignments.length > 0 &&
        (!latestJob || latestJob.status === 'failed')
      )

      const hasPendingSynthesis = synthesizing === type ||
        (latestJob?.status === 'pending' || latestJob?.status === 'running')

      return {
        type,
        label: getTypeLabel(type),
        tier: getTypeTier(type),
        priority: getTypePriority(type),
        assignments: typeAssignments,
        synthesizedDocument: synthesizedDoc,
        lastSynthesis: latestJob,
        needsResynthesis,
        hasPendingSynthesis,
        completenessScore: synthesizedDoc?.completeness_score ?? null,
        missingSections: [], // Would need to fetch from completeness_scores
        suggestions: [],
        schema: null, // Would need to fetch from foundational_schemas
      }
    })
  }, [assignmentsByType, synthesisJobs, synthesizedDocs, synthesizing])

  return {
    // Data
    assignments,
    assignmentsByType,
    synthesisJobs,
    synthesizedDocs,
    slots,

    // State
    loading,
    error,
    synthesizing,

    // Actions
    assignDocument,
    unassignDocument,
    updateAssignment,
    synthesize,
    validateCompleteness,
    reload,

    // Clear error
    clearError: () => setError(null),
  }
}

// Helper functions for type config
function getTypeLabel(type: FoundationalType): string {
  const labels: Record<FoundationalType, string> = {
    brand_dna: 'Brand DNA',
    icp: 'ICP / Buyer Persona',
    tone_of_voice: 'Tone of Voice',
    product_docs: 'Documentación de Producto',
    pricing: 'Precios',
    competitor_analysis: 'Análisis de Competencia',
  }
  return labels[type]
}

function getTypeTier(type: FoundationalType): 1 | 2 | 3 {
  const tiers: Record<FoundationalType, 1 | 2 | 3> = {
    brand_dna: 1,
    icp: 1,
    tone_of_voice: 1,
    product_docs: 1,
    pricing: 1,
    competitor_analysis: 2,
  }
  return tiers[type]
}

function getTypePriority(type: FoundationalType): 'critical' | 'important' | 'recommended' {
  const priorities: Record<FoundationalType, 'critical' | 'important' | 'recommended'> = {
    brand_dna: 'critical',
    icp: 'critical',
    tone_of_voice: 'critical',
    product_docs: 'important',
    pricing: 'important',
    competitor_analysis: 'recommended',
  }
  return priorities[type]
}

/**
 * Hook to get documents that can be assigned (not already assigned)
 */
export function useAvailableDocuments(
  clientId: string,
  foundationalType: FoundationalType,
  existingAssignments: DocumentAssignment[]
) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // Fetch all documents for the client
        const response = await fetch(`/api/v2/documents?clientId=${clientId}`)
        if (!response.ok) throw new Error('Failed to load documents')

        const data = await response.json()
        const allDocs: Document[] = data.documents || []

        // Filter out already assigned documents
        const assignedIds = new Set(existingAssignments.map(a => a.source_document_id))
        const available = allDocs.filter(d =>
          !assignedIds.has(d.id) &&
          d.approval_status !== 'archived'
        )

        setDocuments(available)
      } catch (err) {
        console.error('Error loading available documents:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [clientId, foundationalType, existingAssignments])

  return { documents, loading }
}
