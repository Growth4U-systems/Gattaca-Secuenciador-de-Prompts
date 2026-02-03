'use client'

import { Info, X, ChevronRight } from 'lucide-react'
import { useHelpSystemOptional } from './HelpSystem'

interface ContextualTipProps {
  tipId: string
  title: string
  description: string
  learnMoreTopic?: string
  dismissable?: boolean
  variant?: 'info' | 'tip' | 'warning'
  className?: string
}

/**
 * ContextualTip
 *
 * Inline help tip component that can be dismissed.
 * Uses blue info box styling matching the app's design system.
 */
export default function ContextualTip({
  tipId,
  title,
  description,
  learnMoreTopic,
  dismissable = true,
  variant = 'info',
  className = '',
}: ContextualTipProps) {
  const helpSystem = useHelpSystemOptional()

  // If help system is not available or tip is dismissed, don't render
  if (helpSystem?.isDismissed(tipId)) {
    return null
  }

  const handleDismiss = () => {
    helpSystem?.dismissTip(tipId)
  }

  const handleLearnMore = () => {
    if (learnMoreTopic && helpSystem) {
      helpSystem.openHelpModal(learnMoreTopic)
    }
  }

  const variantStyles = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      iconColor: 'text-blue-500',
      titleColor: 'text-blue-900',
      textColor: 'text-blue-700',
      buttonColor: 'text-blue-600 hover:text-blue-800',
    },
    tip: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
      iconColor: 'text-indigo-500',
      titleColor: 'text-indigo-900',
      textColor: 'text-indigo-700',
      buttonColor: 'text-indigo-600 hover:text-indigo-800',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      iconColor: 'text-amber-500',
      titleColor: 'text-amber-900',
      textColor: 'text-amber-700',
      buttonColor: 'text-amber-600 hover:text-amber-800',
    },
  }

  const styles = variantStyles[variant]

  return (
    <div
      className={`${styles.bg} border ${styles.border} rounded-lg p-3 ${className}`}
      role="note"
    >
      <div className="flex items-start gap-3">
        <Info size={16} className={`${styles.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${styles.titleColor}`}>{title}</p>
          <p className={`text-xs ${styles.textColor} mt-0.5`}>{description}</p>
          {learnMoreTopic && helpSystem && (
            <button
              onClick={handleLearnMore}
              className={`inline-flex items-center gap-1 text-xs ${styles.buttonColor} mt-2 font-medium`}
            >
              Saber mas
              <ChevronRight size={12} />
            </button>
          )}
        </div>
        {dismissable && (
          <button
            onClick={handleDismiss}
            className={`p-1 ${styles.buttonColor} rounded hover:bg-white/50 flex-shrink-0`}
            title="Entendido, no mostrar de nuevo"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Compact inline tip for tighter spaces
 */
export function InlineTip({
  text,
  topic,
}: {
  text: string
  topic?: string
}) {
  const helpSystem = useHelpSystemOptional()

  const handleClick = () => {
    if (topic && helpSystem) {
      helpSystem.openHelpModal(topic)
    }
  }

  return (
    <span
      onClick={topic ? handleClick : undefined}
      className={`inline-flex items-center gap-1 text-xs text-blue-600 ${topic ? 'cursor-pointer hover:text-blue-800' : ''}`}
    >
      <Info size={12} />
      <span>{text}</span>
    </span>
  )
}
