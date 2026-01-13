'use client'

import { useState, useMemo } from 'react'
import { FileText, Trash2, Eye, Link2, Search, Filter, FolderOpen, X, Edit2, Check, Loader2 } from 'lucide-react'
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
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}>
        <span>{style.icon}</span>
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
      {(searchQuery || categoryFilter !== 'all' || assignmentFilter !== 'all') && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Mostrando {filteredDocs.length} de {documents.length} documentos
            {searchQuery && (
              <span className="ml-1">
                para &quot;{searchQuery}&quot;
                {searchInContent && <span className="text-blue-600 ml-1">(en contenido)</span>}
              </span>
            )}
          </span>
          {(searchQuery || categoryFilter !== 'all' || assignmentFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setCategoryFilter('all')
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
              setAssignmentFilter('all')
            }}
            className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="group bg-white border border-gray-100 rounded-2xl p-4 hover:border-blue-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <FileText size={18} className="text-gray-500 group-hover:text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingDocId === doc.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => handleEditKeyDown(e, doc.id)}
                            className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                            autoFocus
                            disabled={savingName}
                          />
                          <button
                            onClick={() => handleSaveName(doc.id)}
                            disabled={savingName || !editingName.trim()}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Guardar"
                          >
                            {savingName ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Check size={16} />
                            )}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={savingName}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                            title="Cancelar"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                            {doc.filename}
                          </h3>
                          {onRename && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStartEdit(doc)
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                              title="Editar nombre"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex items-center flex-wrap gap-2 mt-1">
                        {getCategoryBadge(doc.category)}
                        {doc.token_count && (
                          <span className="text-xs text-gray-500">
                            {formatTokenCount(doc.token_count)} tokens
                          </span>
                        )}
                        {doc.file_size_bytes && (
                          <span className="text-xs text-gray-400">
                            {(doc.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Document Description */}
                  {editingDescDocId === doc.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        onKeyDown={(e) => handleDescKeyDown(e, doc.id)}
                        placeholder="Describe el contenido del documento para facilitar su busqueda y asignacion automatica..."
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 resize-none"
                        autoFocus
                        disabled={savingDescription}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveDescription(doc.id)}
                          disabled={savingDescription}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                        >
                          {savingDescription ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} />
                          )}
                          Guardar
                        </button>
                        <button
                          onClick={handleCancelDescEdit}
                          disabled={savingDescription}
                          className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <span className="text-xs text-gray-400 ml-auto">Cmd+Enter para guardar</span>
                      </div>
                    </div>
                  ) : doc.description ? (
                    <div className="mt-2 group/desc">
                      <p className="text-sm text-gray-600 italic">
                        {doc.description}
                        {onUpdateDescription && (
                          <button
                            onClick={() => handleStartDescEdit(doc)}
                            className="ml-2 text-gray-400 hover:text-blue-600 opacity-0 group-hover/desc:opacity-100 transition-opacity"
                            title="Editar descripcion"
                          >
                            <Edit2 size={12} className="inline" />
                          </button>
                        )}
                      </p>
                    </div>
                  ) : onUpdateDescription ? (
                    <button
                      onClick={() => handleStartDescEdit(doc)}
                      className="mt-2 text-xs text-gray-400 hover:text-blue-600 hover:underline"
                    >
                      + Agregar descripcion
                    </button>
                  ) : null}

                  {/* Content match snippet */}
                  {searchInContent && searchQuery && (() => {
                    const snippet = getContentMatchSnippet(doc.extracted_content, searchQuery)
                    if (!snippet) return null
                    const parts = snippet.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
                    return (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-100 rounded-xl text-xs text-gray-700">
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
                    <div className="flex items-center gap-2 mt-3">
                      <Link2 size={14} className="text-gray-400" />
                      <select
                        value={doc.campaign_id || ''}
                        onChange={(e) => handleCampaignChange(doc.id, e.target.value)}
                        disabled={updatingDoc === doc.id}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      >
                        <option value="">Documento global (todas las campañas)</option>
                        {campaigns.map(campaign => (
                          <option key={campaign.id} value={campaign.id}>
                            {campaign.ecp_name}
                          </option>
                        ))}
                      </select>
                      {updatingDoc === doc.id && (
                        <span className="text-xs text-gray-500">Guardando...</span>
                      )}
                      {doc.campaign_id && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg">
                          Asignado
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onView(doc)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Ver contenido"
                  >
                    <Eye size={18} />
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
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
