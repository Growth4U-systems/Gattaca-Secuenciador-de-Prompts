'use client'

import { AssistantMessage } from './AssistantContext'
import MarkdownRenderer from '@/components/common/MarkdownRenderer'

interface ChatMessageProps {
  message: AssistantMessage
  onConfirmAction?: () => void
  onCancelAction?: () => void
  isLoading?: boolean
}

export default function ChatMessage({
  message,
  onConfirmAction,
  onCancelAction,
  isLoading
}: ChatMessageProps) {
  const isUser = message.role === 'user'
  const hasAction = message.action && message.action.status === 'pending'
  const isExecuting = message.action?.status === 'executing'

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm">
            <MarkdownRenderer content={message.content} className="text-sm" />
          </div>
        )}

        {/* Action status indicators */}
        {message.action && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            {isExecuting && (
              <div className="flex items-center gap-2 text-amber-600">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span className="text-xs font-medium">Ejecutando...</span>
              </div>
            )}

            {message.action.status === 'completed' && (
              <div className="flex items-center gap-2 text-green-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-medium">Completado</span>
              </div>
            )}

            {message.action.status === 'error' && (
              <div className="flex items-center gap-2 text-red-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-xs font-medium">Error</span>
              </div>
            )}

            {message.action.status === 'cancelled' && (
              <div className="flex items-center gap-2 text-gray-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <span className="text-xs font-medium">Cancelado</span>
              </div>
            )}
          </div>
        )}

        {/* Confirmation buttons */}
        {hasAction && !isLoading && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={onConfirmAction}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Ejecutar
            </button>
            <button
              onClick={onCancelAction}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Timestamp on hover */}
        <div className={`text-xs mt-1 opacity-60 ${isUser ? 'text-indigo-200' : 'text-gray-500'}`}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  )
}
