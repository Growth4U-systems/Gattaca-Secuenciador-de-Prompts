'use client'

import { HelpCircle } from 'lucide-react'
import { useHelpSystemOptional } from './HelpSystem'

interface HelpButtonProps {
  topic?: string
  position?: 'bottom-left' | 'bottom-right'
  className?: string
}

/**
 * HelpButton
 *
 * Floating help button that opens the help modal.
 * Position defaults to bottom-left (opposite of FloatingAssistant).
 */
export default function HelpButton({
  topic,
  position = 'bottom-left',
  className = '',
}: HelpButtonProps) {
  const helpSystem = useHelpSystemOptional()

  // Don't render if help system is not available
  if (!helpSystem) {
    return null
  }

  const handleClick = () => {
    helpSystem.openHelpModal(topic)
  }

  const positionClasses = {
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  }

  return (
    <button
      onClick={handleClick}
      className={`
        fixed ${positionClasses[position]} z-50
        w-12 h-12 bg-blue-600 hover:bg-blue-700
        text-white rounded-full shadow-lg hover:shadow-xl
        flex items-center justify-center
        transition-all duration-200 ease-out
        hover:scale-105 active:scale-95
        ${className}
      `}
      title="Abrir ayuda"
      aria-label="Abrir centro de ayuda"
    >
      <HelpCircle size={24} />
    </button>
  )
}

/**
 * Inline help icon button (non-floating)
 */
export function HelpIconButton({
  topic,
  size = 16,
  className = '',
}: {
  topic?: string
  size?: number
  className?: string
}) {
  const helpSystem = useHelpSystemOptional()

  if (!helpSystem) {
    return null
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    helpSystem.openHelpModal(topic)
  }

  return (
    <button
      onClick={handleClick}
      className={`p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors ${className}`}
      title="Ver ayuda"
      aria-label="Ver ayuda"
    >
      <HelpCircle size={size} />
    </button>
  )
}
