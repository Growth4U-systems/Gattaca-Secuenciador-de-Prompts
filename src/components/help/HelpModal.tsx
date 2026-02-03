'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Search, ChevronRight, ExternalLink } from 'lucide-react'
import { useHelpSystem } from './HelpSystem'
import { getAllTopics, getTopic, type HelpTopic } from '@/lib/help/helpContent'

/**
 * HelpModal
 *
 * Full-screen help modal with topic navigation and search.
 * Spanish content for all sections.
 */
export default function HelpModal() {
  const { isHelpModalOpen, closeHelpModal, currentTopic, setCurrentTopic } = useHelpSystem()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null)

  const topics = getAllTopics()

  // Update selected topic when currentTopic changes
  useEffect(() => {
    if (currentTopic) {
      const topic = getTopic(currentTopic)
      if (topic) {
        setSelectedTopic(topic)
      }
    }
  }, [currentTopic])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isHelpModalOpen) {
        closeHelpModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isHelpModalOpen, closeHelpModal])

  // Filter topics based on search
  const filteredTopics = topics.filter((topic) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      topic.title.toLowerCase().includes(query) ||
      topic.shortDescription.toLowerCase().includes(query) ||
      topic.content.some(
        (section) =>
          section.title?.toLowerCase().includes(query) ||
          section.content.toLowerCase().includes(query)
      )
    )
  })

  const handleSelectTopic = useCallback((topic: HelpTopic) => {
    setSelectedTopic(topic)
    setCurrentTopic(topic.id)
  }, [setCurrentTopic])

  const handleBack = useCallback(() => {
    setSelectedTopic(null)
    setCurrentTopic(null)
  }, [setCurrentTopic])

  if (!isHelpModalOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeHelpModal}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            {selectedTopic ? (
              <button
                onClick={handleBack}
                className="p-1 hover:bg-white/50 rounded-lg transition-colors"
              >
                <ChevronRight size={20} className="text-gray-500 rotate-180" />
              </button>
            ) : null}
            <h2 className="text-xl font-bold text-gray-900">
              {selectedTopic ? selectedTopic.title : 'Centro de Ayuda'}
            </h2>
          </div>
          <button
            onClick={closeHelpModal}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {selectedTopic ? (
            // Topic detail view
            <TopicDetailView topic={selectedTopic} onSelectTopic={handleSelectTopic} />
          ) : (
            // Topics list view
            <div className="p-6">
              {/* Search */}
              <div className="relative mb-6">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar en la ayuda..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  autoFocus
                />
              </div>

              {/* Topics grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTopics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onClick={() => handleSelectTopic(topic)}
                  />
                ))}
              </div>

              {filteredTopics.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p>No se encontraron resultados para "{searchQuery}"</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <span>Presiona Escape para cerrar</span>
          <span>Gattaca v1.0</span>
        </div>
      </div>
    </div>
  )
}

// Topic card for the list view
function TopicCard({ topic, onClick }: { topic: HelpTopic; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left group"
    >
      <span className="text-2xl">{topic.icon}</span>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
          {topic.title}
        </h3>
        <p className="text-sm text-gray-500 mt-1">{topic.shortDescription}</p>
      </div>
      <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-1" />
    </button>
  )
}

// Topic detail view
function TopicDetailView({
  topic,
  onSelectTopic,
}: {
  topic: HelpTopic
  onSelectTopic: (topic: HelpTopic) => void
}) {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">{topic.icon}</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{topic.title}</h1>
          <p className="text-gray-500">{topic.shortDescription}</p>
        </div>
      </div>

      {/* Content sections */}
      <div className="space-y-6">
        {topic.content.map((section, index) => (
          <div key={index} className="prose prose-sm max-w-none">
            {section.title && (
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {section.title}
              </h3>
            )}
            <div className="text-gray-700 whitespace-pre-line">
              <FormattedContent content={section.content} />
            </div>
          </div>
        ))}
      </div>

      {/* Related topics */}
      {topic.relatedTopics && topic.relatedTopics.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Temas relacionados</h4>
          <div className="flex flex-wrap gap-2">
            {topic.relatedTopics.map((relatedId) => {
              const related = getTopic(relatedId)
              if (!related) return null
              return (
                <button
                  key={relatedId}
                  onClick={() => onSelectTopic(related)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition-colors"
                >
                  <span>{related.icon}</span>
                  <span>{related.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Simple markdown-like formatting for content
function FormattedContent({ content }: { content: string }) {
  // Split by newlines and process each line
  const lines = content.split('\n')

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        // Skip empty lines
        if (!line.trim()) return <div key={index} className="h-2" />

        // List items
        if (line.trim().startsWith('- ')) {
          return (
            <div key={index} className="flex items-start gap-2 pl-2">
              <span className="text-blue-500 mt-1">•</span>
              <span>
                <InlineFormatting text={line.slice(2)} />
              </span>
            </div>
          )
        }

        // Numbered list items
        const numberedMatch = line.trim().match(/^(\d+)\.\s+/)
        if (numberedMatch) {
          return (
            <div key={index} className="flex items-start gap-2 pl-2">
              <span className="text-blue-500 font-medium min-w-[1.5rem]">
                {numberedMatch[1]}.
              </span>
              <span>
                <InlineFormatting text={line.slice(numberedMatch[0].length)} />
              </span>
            </div>
          )
        }

        // Regular paragraph
        return (
          <p key={index}>
            <InlineFormatting text={line} />
          </p>
        )
      })}
    </div>
  )
}

// Handle inline formatting like **bold** and `code`
function InlineFormatting({ text }: { text: string }) {
  // Simple regex replacements
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Check for bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Check for code
    const codeMatch = remaining.match(/`(.+?)`/)

    // Find which comes first
    const boldIndex = boldMatch?.index ?? Infinity
    const codeIndex = codeMatch?.index ?? Infinity

    if (boldIndex === Infinity && codeIndex === Infinity) {
      // No more formatting
      parts.push(remaining)
      break
    }

    if (boldIndex < codeIndex && boldMatch) {
      // Add text before
      if (boldIndex > 0) {
        parts.push(remaining.slice(0, boldIndex))
      }
      // Add bold
      parts.push(
        <strong key={key++} className="font-semibold text-gray-900">
          {boldMatch[1]}
        </strong>
      )
      remaining = remaining.slice(boldIndex + boldMatch[0].length)
    } else if (codeMatch) {
      // Add text before
      if (codeIndex > 0) {
        parts.push(remaining.slice(0, codeIndex))
      }
      // Add code
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 bg-gray-100 text-indigo-600 rounded text-sm font-mono"
        >
          {codeMatch[1]}
        </code>
      )
      remaining = remaining.slice(codeIndex + codeMatch[0].length)
    }
  }

  return <>{parts}</>
}
