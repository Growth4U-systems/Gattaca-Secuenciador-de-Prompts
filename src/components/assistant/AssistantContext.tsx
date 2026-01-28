'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  action?: {
    type: 'execute_step' | 'start_playbook'
    status: 'pending' | 'confirmed' | 'cancelled' | 'executing' | 'completed' | 'error'
    stepId?: string
    playbookType?: string
    error?: string
  }
}

interface PendingAction {
  type: 'execute_step' | 'start_playbook'
  stepId?: string
  stepName?: string
  playbookType?: string
  playbookName?: string
}

interface AssistantContextType {
  isOpen: boolean
  messages: AssistantMessage[]
  isLoading: boolean
  pendingAction: PendingAction | null
  hasProactiveMessage: boolean

  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
  sendMessage: (content: string) => Promise<void>
  confirmAction: () => Promise<void>
  cancelAction: () => void
  clearMessages: () => void
  setProactiveMessage: (message: string) => void
}

const AssistantContext = createContext<AssistantContextType | null>(null)

export function useAssistant() {
  const context = useContext(AssistantContext)
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider')
  }
  return context
}

interface AssistantProviderProps {
  children: ReactNode
  projectId?: string
}

export function AssistantProvider({ children, projectId }: AssistantProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [hasProactiveMessage, setHasProactiveMessage] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const openChat = useCallback(() => {
    setIsOpen(true)
    setHasProactiveMessage(false)
  }, [])

  const closeChat = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggleChat = useCallback(() => {
    setIsOpen(prev => {
      if (!prev) setHasProactiveMessage(false)
      return !prev
    })
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: AssistantMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          message: content.trim(),
          conversationId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al comunicarse con el asistente')
      }

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId)
      }

      const assistantMessage: AssistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
      }

      // Check if assistant wants to execute an action
      if (data.pendingAction) {
        setPendingAction(data.pendingAction)
        assistantMessage.action = {
          type: data.pendingAction.type,
          status: 'pending',
          stepId: data.pendingAction.stepId,
          playbookType: data.pendingAction.playbookType,
        }
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('[AssistantContext] Error sending message:', error)
      const errorContent = error instanceof Error && error.message !== 'Error al comunicarse con el asistente'
        ? error.message
        : 'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo.'
      const errorMessage: AssistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [projectId, conversationId, messages, isLoading])

  const confirmAction = useCallback(async () => {
    if (!pendingAction) return

    setIsLoading(true)

    // Update the last message to show executing status
    setMessages(prev => {
      const updated = [...prev]
      const lastAssistantIdx = updated.findLastIndex(m => m.role === 'assistant')
      if (lastAssistantIdx >= 0 && updated[lastAssistantIdx].action) {
        updated[lastAssistantIdx] = {
          ...updated[lastAssistantIdx],
          action: { ...updated[lastAssistantIdx].action!, status: 'executing' }
        }
      }
      return updated
    })

    try {
      const response = await fetch('/api/assistant/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: pendingAction,
        }),
      })

      if (!response.ok) {
        throw new Error('Error al ejecutar la acción')
      }

      const data = await response.json()

      // Update message status to completed
      setMessages(prev => {
        const updated = [...prev]
        const lastAssistantIdx = updated.findLastIndex(m => m.role === 'assistant')
        if (lastAssistantIdx >= 0 && updated[lastAssistantIdx].action) {
          updated[lastAssistantIdx] = {
            ...updated[lastAssistantIdx],
            action: { ...updated[lastAssistantIdx].action!, status: 'completed' }
          }
        }
        return updated
      })

      // Add completion message
      const completionMessage: AssistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message || `Listo, he ejecutado "${pendingAction.stepName || pendingAction.playbookName}" correctamente.`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, completionMessage])

    } catch (error) {
      // Update message status to error
      setMessages(prev => {
        const updated = [...prev]
        const lastAssistantIdx = updated.findLastIndex(m => m.role === 'assistant')
        if (lastAssistantIdx >= 0 && updated[lastAssistantIdx].action) {
          updated[lastAssistantIdx] = {
            ...updated[lastAssistantIdx],
            action: {
              ...updated[lastAssistantIdx].action!,
              status: 'error',
              error: 'Error al ejecutar la acción'
            }
          }
        }
        return updated
      })

      const errorMessage: AssistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Hubo un problema al ejecutar la acción. ¿Quieres que lo intente de nuevo?',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setPendingAction(null)
      setIsLoading(false)
    }
  }, [pendingAction, projectId])

  const cancelAction = useCallback(() => {
    if (!pendingAction) return

    // Update the last message to show cancelled status
    setMessages(prev => {
      const updated = [...prev]
      const lastAssistantIdx = updated.findLastIndex(m => m.role === 'assistant')
      if (lastAssistantIdx >= 0 && updated[lastAssistantIdx].action) {
        updated[lastAssistantIdx] = {
          ...updated[lastAssistantIdx],
          action: { ...updated[lastAssistantIdx].action!, status: 'cancelled' }
        }
      }
      return updated
    })

    const cancelMessage: AssistantMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Entendido, no ejecutaré la acción. Avísame si necesitas algo más.',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, cancelMessage])
    setPendingAction(null)
  }, [pendingAction])

  const clearMessages = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setPendingAction(null)
  }, [])

  const setProactiveMessage = useCallback((message: string) => {
    const proactiveMsg: AssistantMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: message,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, proactiveMsg])
    setHasProactiveMessage(true)
  }, [])

  return (
    <AssistantContext.Provider
      value={{
        isOpen,
        messages,
        isLoading,
        pendingAction,
        hasProactiveMessage,
        openChat,
        closeChat,
        toggleChat,
        sendMessage,
        confirmAction,
        cancelAction,
        clearMessages,
        setProactiveMessage,
      }}
    >
      {children}
    </AssistantContext.Provider>
  )
}
