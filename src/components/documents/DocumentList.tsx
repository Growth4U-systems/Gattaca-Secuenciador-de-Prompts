'use client'

import { useState, useMemo } from 'react'
import { FileText, Trash2, Eye, Link2, Search, Filter } from 'lucide-react'
import { DocCategory } from '@/types/database.types'
import { formatTokenCount } from '@/lib/supabase'

interface Document {
  id: string
  filename: string
  category: DocCategory
  token_count: number | null
  file_size_bytes: number | null
  created_at: string
  campaign_id?: string | null
  extracted_content?: string | null
}

interface Campaign {
  id: string
  ecp_name: string
}

interface DocumentListProps {
  documents: Document[]
  campaigns?: Campaign[]
  onDelete: (id: string) => void
  onView: (doc: Document) => void
  onCampaignChange?: (docId: string, campaignId: string | null) => void
}

export default function DocumentList({
  documents,
  campaigns = [],
  onDelete,
  onView,
  onCampaignChange,
}: DocumentListProps) {
  const [updatingDoc, setUpdatingDoc] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInContent, setSearchInContent] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'global' | 'assigned'>('all')

  // Get unique categories
  const categories = useMemo(() => {
    return Array.from(new Set(documents.map(d => d.category))).sort()
  }, [documents])

  // Filter documents
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesFilename = doc.filename.toLowerCase().includes(query)
        const matchesContent = searchInContent && doc.extracted_content?.toLowerCase().includes(query)
        if (!matchesFilename && !matchesContent) {
          return false
        }
      }
      // Category filter
      if (categoryFilter !== 'all' && doc.category !== categoryFilter) {
        return false
      }
      // Assignment filter
      if (assignmentFilter === 'global' && doc.campaign_id) {
        return false
      }
      if (assignmentFilter === 'assigned' && !doc.campaign_id) {
        return false
      }
      return true
    })
  }, [documents, searchQuery, searchInContent, categoryFilter, assignmentFilter])

  // Get content match snippet
  const getContentMatchSnippet = (content: string | null | undefined, query: string): string | null => {
    if (!content || !query) return null
    const lowerContent = content.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const index = lowerContent.indexOf(lowerQuery)
    if (index === -1) return null

    const start = Math.max(0, index - 50)
    const end = Math.min(content.length, index + query.length + 50)
    let snippet = content.substring(start, end)
    if (start > 0) snippet = '...' + snippet
    if (end < content.length) snippet = snippet + '...'
    return snippet
  }

  const handleCampaignChange = async (docId: string, campaignId: string) => {
    if (!onCampaignChange) return

    setUpdatingDoc(docId)
    try {
      await onCampaignChange(docId, campaignId === '' ? null : campaignId)
    } finally {
      setUpdatingDoc(null)
    }
  }

  const getCampaignName = (campaignId: string | null | undefined) => {
    if (!campaignId) return null
    const campaign = campaigns.find(c => c.id === campaignId)
    return campaign?.ecp_name || 'Unknown'
  }

  const getCategoryBadge = (category: DocCategory) => {
    const styles: Record<string, string> = {
      product: 'bg-blue-100 text-blue-800',
      competitor: 'bg-purple-100 text-purple-800',
      research: 'bg-green-100 text-green-800',
      output: 'bg-orange-100 text-orange-800',
    }

    const labels: Record<string, string> = {
      product: '📦 Producto',
      competitor: '🎯 Competidor',
      research: '🔬 Research',
      output: '📝 Output',
    }

    // Default style for custom categories
    const style = styles[category] || 'bg-gray-100 text-gray-800'
    const label = labels[category] || `🏷️ ${category}`

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${style}`}
      >
        {label}
      </span>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText size={48} className="mx-auto mb-4 opacity-50" />
        <p>No hay documentos todavía</p>
        <p className="text-sm mt-2">
          Sube PDFs o DOCX con información de producto, competidores o research
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchInContent ? "Buscar en nombre y contenido..." : "Buscar por nombre..."}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>
          <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={searchInContent}
              onChange={(e) => setSearchInContent(e.target.checked)}
              className="w-3.5 h-3.5 text-blue-600 rounded"
            />
            <span className="text-xs text-gray-500">Buscar dentro del contenido</span>
          </label>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas las categorías ({documents.length})</option>
            {categories.map(cat => {
              const count = documents.filter(d => d.category === cat).length
              return (
                <option key={cat} value={cat}>
                  {cat} ({count})
                </option>
              )
            })}
          </select>
        </div>

        {/* Assignment Filter */}
        {campaigns.length > 0 && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setAssignmentFilter('all')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                assignmentFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setAssignmentFilter('global')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                assignmentFilter === 'global'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Globales
            </button>
            <button
              onClick={() => setAssignmentFilter('assigned')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                assignmentFilter === 'assigned'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Asignados
            </button>
          </div>
        )}
      </div>

      {/* Results count */}
      {(searchQuery || categoryFilter !== 'all' || assignmentFilter !== 'all') && (
        <p className="text-sm text-gray-500">
          Mostrando {filteredDocs.length} de {documents.length} documentos
          {searchQuery && (
            <span className="ml-1">
              para "{searchQuery}"
              {searchInContent && <span className="text-blue-600 ml-1">(búsqueda en contenido)</span>}
            </span>
          )}
        </p>
      )}

      {/* Document List */}
      <div className="space-y-3">
        {filteredDocs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No hay documentos que coincidan con los filtros</p>
          </div>
        ) : (
          filteredDocs.map((doc) => (
        <div
          key={doc.id}
          className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <FileText size={20} className="text-gray-400 flex-shrink-0" />
                <h3 className="font-medium text-gray-900 truncate">
                  {doc.filename}
                </h3>
              </div>

              <div className="flex items-center flex-wrap gap-3 text-sm text-gray-600">
                {getCategoryBadge(doc.category)}
                {doc.token_count && (
                  <span className="text-gray-500">
                    {formatTokenCount(doc.token_count)} tokens
                  </span>
                )}
                {doc.file_size_bytes && (
                  <span className="text-gray-500">
                    {(doc.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                  </span>
                )}
                <span className="text-gray-400">
                  {new Date(doc.created_at).toLocaleDateString('es-ES')}
                </span>
              </div>

              {/* Content match snippet */}
              {searchInContent && searchQuery && (() => {
                const snippet = getContentMatchSnippet(doc.extracted_content, searchQuery)
                if (!snippet) return null
                // Highlight the match
                const parts = snippet.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
                return (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-gray-700">
                    <span className="text-yellow-700 font-medium mr-1">Coincidencia:</span>
                    {parts.map((part, i) =>
                      part.toLowerCase() === searchQuery.toLowerCase()
                        ? <mark key={i} className="bg-yellow-300 px-0.5 rounded">{part}</mark>
                        : <span key={i}>{part}</span>
                    )}
                  </div>
                )
              })()}

              {/* Campaign Assignment */}
              {campaigns.length > 0 && onCampaignChange && (
                <div className="flex items-center gap-2 mt-2">
                  <Link2 size={16} className="text-gray-400" />
                  <select
                    value={doc.campaign_id || ''}
                    onChange={(e) => handleCampaignChange(doc.id, e.target.value)}
                    disabled={updatingDoc === doc.id}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">📂 Documento general (todas las campañas)</option>
                    {campaigns.map(campaign => (
                      <option key={campaign.id} value={campaign.id}>
                        🎯 {campaign.ecp_name}
                      </option>
                    ))}
                  </select>
                  {updatingDoc === doc.id && (
                    <span className="text-xs text-gray-500">Guardando...</span>
                  )}
                  {doc.campaign_id && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      Asignado a campaña
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onView(doc)}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Ver contenido"
              >
                <Eye size={18} />
              </button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      `¿Eliminar "${doc.filename}"? Esta acción no se puede deshacer.`
                    )
                  ) {
                    onDelete(doc.id)
                  }
                }}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Eliminar"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        </div>
          ))
        )}
      </div>
    </div>
  )
}
