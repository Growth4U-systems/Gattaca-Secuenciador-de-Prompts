'use client'

import React, { useRef, useEffect, useCallback, useMemo } from 'react'
import {
  parsePromptForHighlighting,
  getHighlightClasses,
  type HighlightedSegment,
} from '@/lib/utils/variableHighlighter'

interface HighlightedPromptEditorProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  declaredVariables: string[]
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  rows?: number
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * HighlightedPromptEditor
 *
 * A textarea with syntax highlighting for variables using the overlay technique.
 * Variables are highlighted in different colors based on their status:
 * - Valid (declared): indigo
 * - Undeclared: red
 * - Possible typo: amber with wavy underline
 * - Step references: purple
 * - Errors: red with strikethrough
 */
export default function HighlightedPromptEditor({
  value,
  onChange,
  onKeyDown,
  declaredVariables,
  textareaRef: externalRef,
  rows = 12,
  placeholder = 'Escribe {{ para ver las variables disponibles...',
  className = '',
  disabled = false,
}: HighlightedPromptEditorProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const textareaRef = externalRef || internalRef

  // Parse prompt into highlighted segments
  const segments = useMemo(() => {
    return parsePromptForHighlighting(value, declaredVariables)
  }, [value, declaredVariables])

  // Sync scroll between textarea and highlight div
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [textareaRef])

  // Add scroll listener
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.addEventListener('scroll', handleScroll)
      return () => textarea.removeEventListener('scroll', handleScroll)
    }
  }, [textareaRef, handleScroll])

  // Render highlighted content
  const renderHighlightedContent = () => {
    if (segments.length === 0) {
      return (
        <span className="text-gray-400">{placeholder}</span>
      )
    }

    return segments.map((segment, index) => (
      <HighlightedSegmentSpan key={index} segment={segment} />
    ))
  }

  return (
    <div className="relative" style={{ minHeight: `${rows * 1.5}em` }}>
      {/* Highlight layer (behind) - exact same dimensions as textarea */}
      <div
        ref={highlightRef}
        className="absolute inset-0 px-4 py-3 font-mono text-sm overflow-auto pointer-events-none rounded-xl border border-gray-200 bg-white"
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          lineHeight: '1.5',
          maxHeight: `${rows * 1.5 + 1.5}em`,
        }}
        aria-hidden="true"
      >
        {renderHighlightedContent()}
      </div>

      {/* Textarea layer (on top, transparent text) */}
      <textarea
        ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        rows={rows}
        disabled={disabled}
        placeholder=""
        className={`
          w-full px-4 py-3 border border-gray-200 rounded-xl font-mono text-sm
          focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          transition-all resize-none relative z-10
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-transparent'}
          ${className}
        `}
        style={{
          caretColor: '#1f2937', // gray-800
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
          lineHeight: '1.5',
        }}
        spellCheck={false}
      />
    </div>
  )
}

/**
 * Individual highlighted segment component
 */
function HighlightedSegmentSpan({ segment }: { segment: HighlightedSegment }) {
  const classes = getHighlightClasses(segment.type)

  if (segment.type === 'text') {
    // Preserve whitespace and newlines exactly
    return <span className="text-gray-900">{segment.text}</span>
  }

  // For variables, add tooltip on hover for suggestions
  return (
    <span
      className={`${classes} inline`}
      title={
        segment.suggestion
          ? `¿Quisiste decir {{${segment.suggestion}}}?`
          : segment.type === 'variable-undeclared'
            ? 'Variable no declarada'
            : segment.type === 'variable-error'
              ? 'Sintaxis de variable inválida'
              : undefined
      }
    >
      {segment.text}
    </span>
  )
}

/**
 * Hook to create a ref that can be passed to HighlightedPromptEditor
 */
export function usePromptEditorRef() {
  return useRef<HTMLTextAreaElement>(null)
}
