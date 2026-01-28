'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAssistant } from './AssistantContext'
import ChatMessage from './ChatMessage'
import ActionIndicator from './ActionIndicator'

export default function FloatingAssistant() {
  const { user, loading: authLoading } = useAuth()
  const {
    isOpen,
    messages,
    isLoading,
    pendingAction,
    hasProactiveMessage,
    toggleChat,
    closeChat,
    sendMessage,
    confirmAction,
    cancelAction,
    clearMessages,
  } = useAssistant()

  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || pendingAction) return
    const message = inputValue
    setInputValue('')
    await sendMessage(message)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Check if there's an executing action
  const executingAction = messages.find(m => m.action?.status === 'executing')

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={toggleChat}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          isOpen
            ? 'bg-gray-600 hover:bg-gray-700'
            : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'
        }`}
        title="Asistente Gattaca"
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            {/* Notification badge */}
            {hasProactiveMessage && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-xs font-bold items-center justify-center">
                  !
                </span>
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[32rem] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-sm">Asistente Gattaca</h3>
                <p className="text-xs text-indigo-200">Siempre listo para ayudar</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={clearMessages}
                  className="text-indigo-200 hover:text-white p-1"
                  title="Limpiar conversación"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
              <button
                onClick={closeChat}
                className="text-indigo-200 hover:text-white p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {!user && !authLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Inicia sesión</h4>
                <p className="text-sm text-gray-600">
                  Para usar el asistente, necesitas iniciar sesión en tu cuenta.
                </p>
                <a
                  href="/auth"
                  className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  Iniciar sesión
                </a>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Hola, soy tu asistente</h4>
                <p className="text-sm text-gray-600">
                  Puedo ayudarte a navegar Gattaca, explicarte los playbooks, y ejecutar pasos por ti.
                </p>
                <div className="mt-4 space-y-2 w-full">
                  <button
                    onClick={() => sendMessage('¿Qué playbooks hay disponibles?')}
                    className="w-full text-left text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    ¿Qué playbooks hay disponibles?
                  </button>
                  <button
                    onClick={() => sendMessage('¿En qué paso estoy actualmente?')}
                    className="w-full text-left text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    ¿En qué paso estoy actualmente?
                  </button>
                  <button
                    onClick={() => sendMessage('¿Cómo funciona este playbook?')}
                    className="w-full text-left text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    ¿Cómo funciona este playbook?
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onConfirmAction={msg.action?.status === 'pending' ? confirmAction : undefined}
                    onCancelAction={msg.action?.status === 'pending' ? cancelAction : undefined}
                    isLoading={isLoading}
                  />
                ))}
                {isLoading && !executingAction && (
                  <div className="flex justify-start mb-3">
                    <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs text-gray-500">Escribiendo...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Action Indicator */}
          {executingAction && (
            <div className="px-4 py-2 border-t border-gray-200">
              <ActionIndicator
                actionName={executingAction.action?.stepId || 'acción'}
              />
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-white">
            {user ? (
              <>
                <div className="flex gap-2">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={pendingAction ? 'Confirma o cancela la acción arriba...' : 'Escribe un mensaje...'}
                    disabled={isLoading || !!pendingAction}
                    rows={1}
                    className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading || !!pendingAction}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Shift + Enter para nueva línea
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500 text-center py-2">
                Inicia sesión para chatear con el asistente
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
