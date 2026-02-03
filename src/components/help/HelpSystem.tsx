'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const DISMISSED_TIPS_KEY = 'gattaca_dismissed_tips'

interface HelpSystemContextValue {
  // Modal control
  isHelpModalOpen: boolean
  openHelpModal: (topic?: string) => void
  closeHelpModal: () => void
  currentTopic: string | null
  setCurrentTopic: (topic: string | null) => void

  // Contextual tips
  dismissTip: (tipId: string) => void
  isDismissed: (tipId: string) => boolean
  resetDismissedTips: () => void
}

const HelpSystemContext = createContext<HelpSystemContextValue | null>(null)

export function useHelpSystem() {
  const context = useContext(HelpSystemContext)
  if (!context) {
    throw new Error('useHelpSystem must be used within a HelpSystemProvider')
  }
  return context
}

// Optional hook that doesn't throw if outside provider
export function useHelpSystemOptional() {
  return useContext(HelpSystemContext)
}

interface HelpSystemProviderProps {
  children: React.ReactNode
}

export function HelpSystemProvider({ children }: HelpSystemProviderProps) {
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
  const [currentTopic, setCurrentTopic] = useState<string | null>(null)
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set())

  // Load dismissed tips from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(DISMISSED_TIPS_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as string[]
          setDismissedTips(new Set(parsed))
        } catch {
          // Invalid data, ignore
        }
      }
    }
  }, [])

  // Save dismissed tips to localStorage
  const saveDismissedTips = useCallback((tips: Set<string>) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISSED_TIPS_KEY, JSON.stringify(Array.from(tips)))
    }
  }, [])

  const openHelpModal = useCallback((topic?: string) => {
    if (topic) {
      setCurrentTopic(topic)
    }
    setIsHelpModalOpen(true)
  }, [])

  const closeHelpModal = useCallback(() => {
    setIsHelpModalOpen(false)
  }, [])

  const dismissTip = useCallback((tipId: string) => {
    setDismissedTips((prev) => {
      const newSet = new Set(prev)
      newSet.add(tipId)
      saveDismissedTips(newSet)
      return newSet
    })
  }, [saveDismissedTips])

  const isDismissed = useCallback((tipId: string) => {
    return dismissedTips.has(tipId)
  }, [dismissedTips])

  const resetDismissedTips = useCallback(() => {
    setDismissedTips(new Set())
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DISMISSED_TIPS_KEY)
    }
  }, [])

  const value: HelpSystemContextValue = {
    isHelpModalOpen,
    openHelpModal,
    closeHelpModal,
    currentTopic,
    setCurrentTopic,
    dismissTip,
    isDismissed,
    resetDismissedTips,
  }

  return (
    <HelpSystemContext.Provider value={value}>
      {children}
    </HelpSystemContext.Provider>
  )
}
