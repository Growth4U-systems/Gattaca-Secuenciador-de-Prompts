'use client'

import { useState, useMemo } from 'react'
import { FileText, Trash2, Eye, Link2, Search, Filter, FolderOpen, X, Edit2, Check, Loader2, Tag } from 'lucide-react'
import { DocCategory } from '@/types/database.types'
import { formatTokenCount } from '@/lib/supabase'
import { useModal } from '@/components/ui'

interface Document {
  id: string
  filename: string
  category: DocCategory
  description?: string
  token_count: number | null
  file_size_bytes: number | null
  created_at: string
  campaign_id?: string | null
  extracted_content?: string | null
  tags?: string[] | null
  source_type?: string | null
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
  onRename?: (docId: string, newName: string) => Promise<void>
  onUpdateDescription?: (docId: string, description: string) => Promise<void>
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  product: { bg: 'bg-blue-50', text: 'text-blue-700', icon: '📦' },
  competitor: { bg: 'bg-purple-50', text: 'text-purple-700', icon: '🎯' },
  research: { bg: 'bg-green-50', text: 'text-green-700', icon: '🔬' },
  output: { bg: 'bg-orange-50', text: 'text-orange-700', icon: '📝' },
}

export default function DocumentList({
  documents,
  campaigns = [],
  onDelete,
  onView,
  onCampaignChange,
  onRename,
  onUpdateDescription,
}: DocumentListProps) {
  const modal = useModal()

  const [updatingDoc, setUpdatingDoc] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInContent, setSearchInContent] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'global' | 'assigned'>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')

  // State for inline editing
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // State for description editing
  const [editingDescDocId, setEditingDescDocId] = useState<string | null>(null)
  const [editingDescription, setEditingDescription] = useState('')
  const [savingDescription, setSavingDescription] = useState(false)

  // Get unique categories
  const categories = useMemo(() => {
    return Array.from(new Set(documents.map(d => d.category))).sort()
  }, [documents])

  // Get unique tags with counts
  const allTags = useMemo(() => {
    const tagCounts: Record<string, number> = {}
    documents.forEach(doc => {
      doc.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    })
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .map(([tag, count]) => ({ tag, count }))
  }, [documents])

  // Filter documents
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesFilename = doc.filename.toLowerCase().includes(query)
        const matchesContent = searchInContent && doc.extracted_content?.toLowerCase().includes(query)
        const matchesTags = doc.tags?.some(tag => tag.toLowerCase().includes(query))
        if (!matchesFilename && !matchesContent && !matchesTags) {
          return false
        }
      }
      // Category filter
      if (categoryFilter !== 'all' && doc.category !== categoryFilter) {
        return false
      }
      // Tag filter
      if (tagFilter !== 'all' && !doc.tags?.includes(tagFilter)) {
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
  }, [documents, searchQuery, searchInContent, categoryFilter, tagFilter, assignmentFilter])

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

  // Handle starting the edit mode
  const handleStartEdit = (doc: Document) => {
    setEditingDocId(doc.id)
    setEditingName(doc.filename)
  }

  // Handle canceling the edit
  const handleCancelEdit = () => {
    setEditingDocId(null)
    setEditingName('')
  }

  // Handle saving the new name
  const handleSaveName = async (docId: string) => {
    if (!onRename || !editingName.trim()) return

    setSavingName(true)
    try {
      await onRename(docId, editingName.trim())
      setEditingDocId(null)
      setEditingName('')
    } catch (error) {
      console.error('Error renaming document:', error)
    } finally {
      setSavingName(false)
    }
  }

  // Handle key press in the edit input
  const handleEditKeyDown = (e: React.KeyboardEvent, docId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveName(docId)
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  // Handle starting description edit
  const handleStartDescEdit = (doc: Document) => {
    setEditingDescDocId(doc.id)
    setEditingDescription(doc.description || '')
  }

  // Handle canceling description edit
  const handleCancelDescEdit = () => {
    setEditingDescDocId(null)
    setEditingDescription('')
  }

  // Handle saving description
  const handleSaveDescription = async (docId: string) => {
    if (!onUpdateDescription) return

    setSavingDescription(true)
    try {
      await onUpdateDescription(docId, editingDescription.trim())
      setEditingDescDocId(null)
      setEditingDescription('')
    } catch (error) {
      console.error('Error updating description:', error)
    } finally {
      setSavingDescription(false)
    }
  }

  // Handle key press in description textarea
  const handleDescKeyDown = (e: React.KeyboardEvent, docId: string) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault()
      handleSaveDescription(docId)
    } else if (e.key === 'Escape') {
      handleCancelDescEdit()
    }
  }

  const getCategoryBadge = (category: DocCategory) => {
    const style = CATEGORY_STYLES[category] || { bg: 'bg-gray-50', text: 'text-gray-700', icon: '🏷️' }
    const label = category.charAt(0).toUpperCase() + category.slice(1)

    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>
        <span className="text-[10px]">{style.icon}</span>
        {label}
      </span>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-block p-4 bg-gray-100 rounded-2xl mb-4">
          <FolderOpen className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No hay documentos</h3>
        <p className="text-gray-500 text-sm">
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
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchInContent ? "Buscar en nombre y contenido..." : "Buscar por nombre..."}
              className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={searchInContent}
              onChange={(e) => setSearchInContent(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
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
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todas ({documents.length})</option>
            {categories.map(cat => {
              const count = documents.filter(d => d.category === cat).length
              const style = CATEGORY_STYLES[cat]
              return (
                <option key={cat} value={cat}>
                  {style?.icon || '🏷️'} {cat} ({count})
                </option>
              )
            })}
          </select>
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-gray-400" />
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tags: Todos</option>
              {allTags.map(({ tag, count }) => (
                <option key={tag} value={tag}>
                  {tag} ({count})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Assignment Filter */}
        {campaigns.length > 0 && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { value: 'all', label: 'Todos' },
              { value: 'global', label: 'Globales' },
              { value: 'assigned', label: 'Asignados' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setAssignmentFilter(filter.value as typeof assignmentFilter)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  assignmentFilter === filter.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      {(searchQuery || categoryFilter !== 'all' || tagFilter !== 'all' || assignmentFilter !== 'all') && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Mostrando {filteredDocs.length} de {documents.length} documentos
            {searchQuery && (
              <span className="ml-1">
                para &quot;{searchQuery}&quot;
                {searchInContent && <span className="text-blue-600 ml-1">(en contenido)</span>}
              </span>
            )}
            {tagFilter !== 'all' && (
              <span className="ml-1">
                con tag <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">{tagFilter}</span>
              </span>
            )}
          </span>
          {(searchQuery || categoryFilter !== 'all' || tagFilter !== 'all' || assignmentFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setCategoryFilter('all')
                setTagFilter('all')
                setAssignmentFilter('all')
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Document List */}
      {filteredDocs.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay documentos que coincidan</p>
          <button
            onClick={() => {
              setSearchQuery('')
              setCategoryFilter('all')
              setTagFilter('all')
              setAssignmentFilter('all')
            }}
            className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="group bg-white border border-gray-100 rounded-xl px-3 py-2.5 hover:border-blue-200 hover:shadow-sm transition-all"
            >
              {/* Main row - single line layout */}
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="p-1.5 bg-gray-50 rounded-lg group-hover:bg-blue-50 transition-colors flex-shrink-0">
                  <FileText size={16} className="text-gray-400 group-hover:text-blue-600" />
                </div>

                {/* Title & Badges */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {editingDocId === doc.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, doc.id)}
                        className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                        autoFocus
                        disabled={savingName}
                      />
                      <button
                        onClick={() => handleSaveName(doc.id)}
                        disabled={savingName || !editingName.trim()}
                        className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Guardar"
                      >
                        {savingName ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={savingName}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                        title="Cancelar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-medium text-sm text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {doc.filename}
                      </h3>
                      {onRename && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartEdit(doc) }}
                          className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                          title="Editar nombre"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Inline badges */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {getCategoryBadge(doc.category)}
                  {doc.token_count && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatTokenCount(doc.token_count)}
                    </span>
                  )}
                </div>

                {/* Tags inline */}
                {doc.tags && doc.tags.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                    {doc.tags.slice(0, 3).map((tag, idx) => (
                      <button
                        key={idx}
                        onClick={() => setTagFilter(tag)}
                        className={`px-1.5 py-0.5 text-[10px] rounded-full transition-colors ${
                          tagFilter === tag
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                        }`}
                        title={`Filtrar por "${tag}"`}
                      >
                        {tag}
                      </button>
                    ))}
                    {doc.tags.length > 3 && (
                      <span className="text-[10px] text-gray-400">+{doc.tags.length - 3}</span>
                    )}
                    {doc.source_type === 'scraper' && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-green-50 text-green-600 rounded">
                        Scraper
                      </span>
                    )}
                  </div>
                )}

                {/* Campaign dropdown - compact */}
                {campaigns.length > 0 && onCampaignChange && (
                  <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                    <Link2 size={12} className="text-gray-300" />
                    <select
                      value={doc.campaign_id || ''}
                      onChange={(e) => handleCampaignChange(doc.id, e.target.value)}
                      disabled={updatingDoc === doc.id}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 max-w-[180px] truncate"
                    >
                      <option value="">Documento global (todas las campañas)</option>
                      {campaigns.map(campaign => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.ecp_name}
                        </option>
                      ))}
                    </select>
                    {updatingDoc === doc.id && <Loader2 size={12} className="text-gray-400 animate-spin" />}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => onView(doc)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Ver contenido"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={async () => {
                      const confirmed = await modal.confirm({
                        title: 'Eliminar documento',
                        message: `¿Eliminar "${doc.filename}"? Esta acción no se puede deshacer.`,
                        confirmText: 'Eliminar',
                        cancelText: 'Cancelar',
                        variant: 'danger',
                      })
                      if (confirmed) {
                        onDelete(doc.id)
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Description row - only when exists, compact */}
              {editingDescDocId === doc.id ? (
                <div className="mt-2 ml-8 space-y-1.5">
                  <textarea
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    onKeyDown={(e) => handleDescKeyDown(e, doc.id)}
                    placeholder="Describe el contenido del documento..."
                    rows={2}
                    className="w-full px-2 py-1.5 text-xs border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 resize-none"
                    autoFocus
                    disabled={savingDescription}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveDescription(doc.id)}
                      disabled={savingDescription}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      {savingDescription ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                      Guardar
                    </button>
                    <button
                      onClick={handleCancelDescEdit}
                      disabled={savingDescription}
                      className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : doc.description ? (
                <div className="mt-1 ml-8 group/desc">
                  <p className="text-xs text-gray-500 truncate max-w-2xl">
                    {doc.description}
                    {onUpdateDescription && (
                      <button
                        onClick={() => handleStartDescEdit(doc)}
                        className="ml-1.5 text-gray-400 hover:text-blue-600 opacity-0 group-hover/desc:opacity-100 transition-opacity"
                        title="Editar descripcion"
                      >
                        <Edit2 size={10} className="inline" />
                      </button>
                    )}
                  </p>
                </div>
              ) : onUpdateDescription ? (
                <button
                  onClick={() => handleStartDescEdit(doc)}
                  className="mt-1 ml-8 text-[10px] text-gray-400 hover:text-blue-600"
                >
                  + Descripción
                </button>
              ) : null}

              {/* Content match snippet - only when searching */}
              {searchInContent && searchQuery && (() => {
                const snippet = getContentMatchSnippet(doc.extracted_content, searchQuery)
                if (!snippet) return null
                const parts = snippet.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
                return (
                  <div className="mt-1.5 ml-8 p-1.5 bg-yellow-50 border border-yellow-100 rounded-lg text-xs text-gray-600">
                    <span className="text-yellow-600 font-medium mr-1">Coincidencia:</span>
                    {parts.map((part, i) =>
                      part.toLowerCase() === searchQuery.toLowerCase()
                        ? <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark>
                        : <span key={i}>{part}</span>
                    )}
                  </div>
                )
              })()}

              {/* Mobile: Tags & Campaign on second row */}
              <div className="sm:hidden mt-2 ml-8 flex flex-wrap items-center gap-1.5">
                {doc.tags && doc.tags.length > 0 && doc.tags.map((tag, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTagFilter(tag)}
                    className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                      tagFilter === tag ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {campaigns.length > 0 && onCampaignChange && (
                <div className="md:hidden mt-1.5 ml-8 flex items-center gap-1.5">
                  <Link2 size={11} className="text-gray-300" />
                  <select
                    value={doc.campaign_id || ''}
                    onChange={(e) => handleCampaignChange(doc.id, e.target.value)}
                    disabled={updatingDoc === doc.id}
                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white"
                  >
                    <option value="">Global (todas las campañas)</option>
                    {campaigns.map(campaign => (
                      <option key={campaign.id} value={campaign.id}>{campaign.ecp_name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
