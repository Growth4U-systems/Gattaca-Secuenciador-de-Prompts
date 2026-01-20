'use client'

import { useState, useEffect } from 'react'
import { PlaybookShell, videoViralIAConfig } from '../playbook'
import { PlaybookState } from '../playbook/types'

interface VideoViralIAPlaybookProps {
  projectId: string
}

/**
 * VideoViralIAPlaybook - Using the unified playbook architecture
 *
 * This component wraps the PlaybookShell with the Video Viral IA configuration.
 * It provides:
 * - Dual panel layout (navigation + work area)
 * - Step-by-step guided flow for video creation
 * - AI-powered idea generation, scene creation, and video composition
 */
export default function VideoViralIAPlaybook({ projectId }: VideoViralIAPlaybookProps) {
  const [initialState, setInitialState] = useState<Partial<PlaybookState> | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  // Load existing playbook state from the project if any
  useEffect(() => {
    async function loadState() {
      try {
        const response = await fetch(`/api/projects/${projectId}/playbook-state`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.state) {
            setInitialState(data.state)
          }
        }
      } catch (error) {
        console.error('Error loading playbook state:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadState()
  }, [projectId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  return (
    <PlaybookShell
      projectId={projectId}
      playbookConfig={videoViralIAConfig}
      initialState={initialState}
    />
  )
}
