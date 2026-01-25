'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PlaybookShell, nicheFinderConfig } from '../playbook'
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
  }, [sessionParam])

  async function loadSessionState(sid: string) {
    try {
      // First try to load from session API
      const sessionResponse = await fetch(`/api/playbook/sessions/${sid}`)
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json()
        if (sessionData.session) {
          // Set initial state from session config if present
          const session = sessionData.session
          if (session.config && Object.keys(session.config).length > 0) {
            setInitialState({
              config: session.config,
            })
          }
        }
      }

      // Also try to load from legacy playbook-state API
      const response = await fetch(`/api/projects/${projectId}/playbook-state`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.state) {
          setInitialState(prev => ({
            ...prev,
            ...data.state,
          }))
        }
      }
    } catch (error) {
      console.error('Error loading session state:', error)
    } finally {
      setIsLoading(false)
    }
  }

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
    <PlaybookShell
      projectId={projectId}
      playbookConfig={nicheFinderConfig}
      initialState={initialState}
      sessionId={sessionId}
      useWizardNav={true}
    />
  )
}
