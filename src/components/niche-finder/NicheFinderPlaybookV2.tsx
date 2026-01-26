'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PlaybookShellV2, nicheFinderConfig } from '../playbook'
import { PlaybookState } from '../playbook/types'
import StartSessionDialog from '../playbook/StartSessionDialog'
import AllSessionsPanel from '../playbook/AllSessionsPanel'

interface NicheFinderPlaybookV2Props {
  projectId: string
}

/**
 * NicheFinderPlaybook V2 - Using the new unified playbook architecture
 *
 * This component wraps the PlaybookShell with the niche finder configuration.
 * It provides:
 * - Session initialization dialog for new sessions
 * - URL-based session bookmarking (?session=abc123)
 * - Dual panel layout (navigation + work area)
 * - Step-by-step guided flow
 * - Automatic execution where possible
 * - Minimal user decisions
 */
export default function NicheFinderPlaybookV2({ projectId }: NicheFinderPlaybookV2Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionParam = searchParams.get('session')

  const [sessionId, setSessionId] = useState<string | null>(sessionParam)
  const [showDialog, setShowDialog] = useState(false)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [initialState, setInitialState] = useState<Partial<PlaybookState> | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  // Memoized function to load session state - handles both new and legacy APIs
  // Uses Promise.allSettled to avoid race conditions with deterministic merge priority
  const loadSessionState = useCallback(async (sid: string) => {
    try {
      // Fetch both APIs in parallel with Promise.allSettled
      // This ensures we wait for both to complete before merging
      const [sessionResult, legacyResult] = await Promise.allSettled([
        fetch(`/api/playbook/sessions/${sid}`).then(async (res) => {
          if (!res.ok) return null
          const data = await res.json()
          return data.session
        }),
        fetch(`/api/projects/${projectId}/playbook-state`).then(async (res) => {
          if (!res.ok) return null
          const data = await res.json()
          return data.success ? data.state : null
        }),
      ])

      // Build state with deterministic priority: legacy first, then new API (new overwrites)
      let mergedState: Partial<PlaybookState> = {}

      // 1. Apply legacy state first (lower priority)
      if (legacyResult.status === 'fulfilled' && legacyResult.value) {
        mergedState = { ...mergedState, ...legacyResult.value }
      }

      // 2. Apply new session API state (higher priority - overwrites legacy)
      if (sessionResult.status === 'fulfilled' && sessionResult.value) {
        const session = sessionResult.value
        if (session.config && Object.keys(session.config).length > 0) {
          mergedState = { ...mergedState, config: session.config }
        }
      }

      // Only set state if we have data
      if (Object.keys(mergedState).length > 0) {
        setInitialState(mergedState)
      }
    } catch (error) {
      console.error('Error loading session state:', error)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  // Check for session param or show dialog
  useEffect(() => {
    if (sessionParam) {
      // URL has session param - load that session
      setSessionId(sessionParam)
      loadSessionState(sessionParam)
    } else {
      // No session param - show dialog
      setShowDialog(true)
      setIsLoading(false)
    }
  }, [sessionParam, loadSessionState])

  const handleSessionStart = (newSessionId: string) => {
    setSessionId(newSessionId)
    setShowDialog(false)
    setIsLoading(false)

    // Update URL with session param for bookmarkability
    const currentUrl = new URL(window.location.href)
    currentUrl.searchParams.set('session', newSessionId)
    router.replace(currentUrl.pathname + currentUrl.search)
  }

  const handleDialogCancel = () => {
    // Navigate back or close - could navigate to playbooks list
    setShowDialog(false)
    // Stay on the page but don't show anything
  }

  const handleViewAllSessions = () => {
    setShowDialog(false)
    setShowAllSessions(true)
  }

  const handleAllSessionsClose = () => {
    setShowAllSessions(false)
    // Re-show the start dialog if no session is active
    if (!sessionId) {
      setShowDialog(true)
    }
  }

  const handleAllSessionsStartNew = () => {
    setShowAllSessions(false)
    setShowDialog(true)
  }

  // Show all sessions panel
  if (showAllSessions) {
    return (
      <AllSessionsPanel
        projectId={projectId}
        playbookType="niche_finder"
        onSessionSelect={handleSessionStart}
        onClose={handleAllSessionsClose}
        onStartNew={handleAllSessionsStartNew}
      />
    )
  }

  // Show dialog if no session
  if (showDialog) {
    return (
      <StartSessionDialog
        projectId={projectId}
        playbookType="niche_finder"
        onSessionStart={handleSessionStart}
        onCancel={handleDialogCancel}
        onViewAllSessions={handleViewAllSessions}
      />
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    )
  }

  // No session and dialog was cancelled
  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-gray-500 mb-4">Necesitas iniciar una sesión para usar este playbook.</p>
        <button
          onClick={() => setShowDialog(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Iniciar nueva sesión
        </button>
      </div>
    )
  }

  return (
    <PlaybookShellV2
      projectId={projectId}
      playbookConfig={nicheFinderConfig}
      initialState={initialState}
      sessionId={sessionId}
      navigationStyle="wizard"
    />
  )
}
