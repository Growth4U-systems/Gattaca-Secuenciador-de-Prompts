'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Trash2, Link2, Search, Filter, FolderOpen, X, Edit2, Check, Loader2, Tag, ChevronDown, ChevronRight, Maximize2, History, FolderInput, Plus, Users } from 'lucide-react'
import { DocCategory } from '@/types/database.types'
import { formatTokenCount } from '@/lib/supabase'
import { useModal } from '@/components/ui'
import CSVTableViewer from './CSVTableViewer'
import JSONViewer from './JSONViewer'
import { DocumentNameValidationBadge } from './DocumentNameInput'

type DocumentTier = 'T1' | 'T2' | 'T3'
type DocumentSourceType = 'import' | 'scraper' | 'playbook' | 'api'

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
  source_type?: DocumentSourceType | string | null
  tier?: DocumentTier | null
  project_id?: string | null
  client_id?: string | null
  isShared?: boolean
  version_count?: number
  folder?: string | null
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
  onTierChange?: (docId: string, tier: DocumentTier) => Promise<void>
  onMoveToFolder?: (docId: string, folder: string | null) => Promise<void>
  onEditDocument?: (doc: Document) => void
  availableFolders?: string[]
  showContextLakeFilters?: boolean
  groupByCompetitor?: boolean
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  product: { bg: 'bg-blue-50', text: 'text-blue-700', icon: '📦' },
  competitor: { bg: 'bg-purple-50', text: 'text-purple-700', icon: '🎯' },
  research: { bg: 'bg-green-50', text: 'text-green-700', icon: '🔬' },
  output: { bg: 'bg-orange-50', text: 'text-orange-700', icon: '📝' },
}

const SOURCE_TYPE_STYLES: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  import: { bg: 'bg-gray-50', text: 'text-gray-600', icon: '📥', label: 'Importado' },
  scraper: { bg: 'bg-green-50', text: 'text-green-600', icon: '🔍', label: 'Scraper' },
  playbook: { bg: 'bg-blue-50', text: 'text-blue-600', icon: '🎯', label: 'Playbook' },
  api: { bg: 'bg-purple-50', text: 'text-purple-600', icon: '🔗', label: 'API' },
  // Legacy values mapped to import
  manual: { bg: 'bg-gray-50', text: 'text-gray-600', icon: '📥', label: 'Importado' },
  upload: { bg: 'bg-gray-50', text: 'text-gray-600', icon: '📥', label: 'Importado' },
}

const TIER_STYLES: Record<DocumentTier, { bg: string; text: string; label: string; description: string }> = {
  T1: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'T1', description: 'Siempre incluido' },
  T2: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'T2', description: 'Si es relevante' },
  T3: { bg: 'bg-gray-50', text: 'text-gray-500', label: 'T3', description: 'Opcional' },
}

export default function DocumentList({
  documents,
  campaigns = [],
  onDelete,
  onView,
  onCampaignChange,
  onRename,
  onUpdateDescription,
  onTierChange,
  onMoveToFolder,
  onEditDocument,
  availableFolders = [],
  showContextLakeFilters = false,
  groupByCompetitor = false,
}: DocumentListProps) {
  const modal = useModal()

  const [updatingDoc, setUpdatingDoc] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInContent, setSearchInContent] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'global' | 'assigned'>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [sharedFilter, setSharedFilter] = useState<'all' | 'project' | 'shared'>('all')

  // State for inline editing
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // State for description editing
  const [editingDescDocId, setEditingDescDocId] = useState<string | null>(null)
  const [editingDescription, setEditingDescription] = useState('')
  const [savingDescription, setSavingDescription] = useState(false)

  // State for expanded content
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null)

  // State for bulk selection
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const selectAllRef = useRef<HTMLInputElement>(null)

  // State for folder menu
  const [folderMenuDocId, setFolderMenuDocId] = useState<string | null>(null)
  const [movingToFolder, setMovingToFolder] = useState(false)
  const [newFolderInput, setNewFolderInput] = useState('')
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)

  // State for competitor group expansion
  const [expandedCompetitors, setExpandedCompetitors] = useState<Set<string>>(new Set())

  const toggleCompetitorGroup = (name: string) => {
    setExpandedCompetitors(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

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
      // Context Lake filters
      if (sourceTypeFilter !== 'all' && doc.source_type !== sourceTypeFilter) {
        return false
      }
      if (tierFilter !== 'all' && doc.tier !== tierFilter) {
        return false
      }
      if (sharedFilter === 'project' && doc.isShared) {
        return false
      }
      if (sharedFilter === 'shared' && !doc.isShared) {
        return false
      }
      return true
    })
    // Sort: competitor docs first, grouped by competitor name, then the rest by date
    .sort((a, b) => {
      const aIsCompetitor = a.category === 'competitor'
      const bIsCompetitor = b.category === 'competitor'
      if (aIsCompetitor && !bIsCompetitor) return -1
      if (!aIsCompetitor && bIsCompetitor) return 1
      if (aIsCompetitor && bIsCompetitor) {
        // Group by competitor name (first tag that isn't a source/date tag)
        const aName = a.tags?.[0] || ''
        const bName = b.tags?.[0] || ''
        if (aName !== bName) return aName.localeCompare(bName)
      }
      // Within same group, sort by date descending
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [documents, searchQuery, searchInContent, categoryFilter, tagFilter, assignmentFilter, sourceTypeFilter, tierFilter, sharedFilter])

  // Group documents by competitor name (tags[0]) when groupByCompetitor is enabled
  const competitorGroups = useMemo(() => {
    if (!groupByCompetitor) return null
    const groups: Record<string, typeof filteredDocs> = {}
    filteredDocs.forEach(doc => {
      const name = doc.tags?.[0] || 'Sin competidor'
      if (!groups[name]) groups[name] = []
      groups[name].push(doc)
    })
    // Sort group keys alphabetically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [groupByCompetitor, filteredDocs])

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

  // Handle moving document to folder
  const handleMoveToFolder = async (docId: string, folder: string | null) => {
    if (!onMoveToFolder) return
    setMovingToFolder(true)
    try {
      await onMoveToFolder(docId, folder)
      setFolderMenuDocId(null)
      setShowNewFolderInput(false)
      setNewFolderInput('')
    } catch (error) {
      console.error('Error moving to folder:', error)
    } finally {
      setMovingToFolder(false)
    }
  }

  // Handle creating new folder and moving doc to it
  const handleCreateFolderAndMove = async (docId: string) => {
    if (!newFolderInput.trim()) return
    await handleMoveToFolder(docId, newFolderInput.trim())
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

  // Detect content type for inline viewer
  const getContentType = (content: string | null | undefined): 'json' | 'csv' | 'text' => {
    if (!content) return 'text'
    const trimmed = content.trim()
    const firstLine = content.split('\n')[0] || ''

    // Check if JSON
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        JSON.parse(trimmed)
        return 'json'
      } catch {
        if ((trimmed.startsWith('[') && trimmed.includes(']')) ||
            (trimmed.startsWith('{') && trimmed.includes('}'))) {
          return 'json'
        }
      }
    }

    // Check if CSV
    if (firstLine.includes(',') && firstLine.split(',').length >= 3) {
      return 'csv'
    }

    return 'text'
  }

  const toggleExpand = (docId: string) => {
    setExpandedDocId(expandedDocId === docId ? null : docId)
  }

  // Handle select all checkbox indeterminate state
  useEffect(() => {
    if (selectAllRef.current) {
      const allSelected = selectedDocs.size === filteredDocs.length && filteredDocs.length > 0
      const someSelected = selectedDocs.size > 0 && selectedDocs.size < filteredDocs.length
      selectAllRef.current.indeterminate = someSelected
      selectAllRef.current.checked = allSelected
    }
  }, [selectedDocs.size, filteredDocs.length])

  // Toggle selection for a document
  const toggleDocSelection = (docId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const newSelected = new Set(selectedDocs)
    if (newSelected.has(docId)) {
      newSelected.delete(docId)
    } else {
      newSelected.add(docId)
    }
    setSelectedDocs(newSelected)
  }

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedDocs.size === filteredDocs.length) {
      setSelectedDocs(new Set())
    } else {
      setSelectedDocs(new Set(filteredDocs.map(d => d.id)))
    }
  }

  // Handle bulk delete
  const handleBulkDelete = async () => {
    const confirmed = await modal.confirm({
      title: 'Eliminar documentos',
      message: `¿Eliminar ${selectedDocs.size} documento(s)? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar todos',
      cancelText: 'Cancelar',
      variant: 'danger',
    })

    if (confirmed) {
      setBulkDeleting(true)
      try {
        for (const docId of selectedDocs) {
          await onDelete(docId)
        }
        setSelectedDocs(new Set())
      } finally {
        setBulkDeleting(false)
      }
    }
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

  // Render document row inner content (shared between flat and grouped views)
  const renderDocRow = (doc: Document, isExpanded: boolean, contentType: string | null) => (
    <>
      {/* Main row - single line layout */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
        onClick={() => toggleExpand(doc.id)}
      >
        <input type="checkbox" checked={selectedDocs.has(doc.id)} onChange={() => {}} onClick={(e) => toggleDocSelection(doc.id, e)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0 cursor-pointer" />
        <div className="flex-shrink-0 text-gray-400">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {editingDocId === doc.id ? (
            <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
              <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} onKeyDown={(e) => handleEditKeyDown(e, doc.id)} className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" autoFocus disabled={savingName} />
              <button onClick={() => handleSaveName(doc.id)} disabled={savingName || !editingName.trim()} className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50 disabled:cursor-not-allowed" title="Guardar">{savingName ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}</button>
              <button onClick={handleCancelEdit} disabled={savingName} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50" title="Cancelar"><X size={14} /></button>
            </div>
          ) : (
            <>
              <h3 className="font-medium text-sm text-gray-900 truncate group-hover:text-blue-600 transition-colors">{doc.filename}</h3>
              <DocumentNameValidationBadge filename={doc.filename} size="xs" />
              {onRename && <button onClick={(e) => { e.stopPropagation(); handleStartEdit(doc) }} className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" title="Editar nombre"><Edit2 size={12} /></button>}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {doc.isShared && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600" title="Documento compartido del cliente">🔗</span>}
          {doc.tier && onTierChange ? (
            <select value={doc.tier} onChange={async (e) => { e.stopPropagation(); await onTierChange(doc.id, e.target.value as DocumentTier) }} onClick={(e) => e.stopPropagation()} className={`px-1.5 py-0.5 rounded text-[10px] font-medium border-0 cursor-pointer ${TIER_STYLES[doc.tier as DocumentTier]?.bg || 'bg-gray-50'} ${TIER_STYLES[doc.tier as DocumentTier]?.text || 'text-gray-600'}`} title={TIER_STYLES[doc.tier as DocumentTier]?.description}>
              <option value="T1">T1</option><option value="T2">T2</option><option value="T3">T3</option>
            </select>
          ) : doc.tier ? (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${TIER_STYLES[doc.tier as DocumentTier]?.bg || 'bg-gray-50'} ${TIER_STYLES[doc.tier as DocumentTier]?.text || 'text-gray-600'}`} title={TIER_STYLES[doc.tier as DocumentTier]?.description}>{doc.tier}</span>
          ) : null}
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${doc.source_type ? (SOURCE_TYPE_STYLES[doc.source_type]?.bg || 'bg-gray-50') : 'bg-gray-50'} ${doc.source_type ? (SOURCE_TYPE_STYLES[doc.source_type]?.text || 'text-gray-600') : 'text-gray-600'}`} title={`Origen: ${doc.source_type ? (SOURCE_TYPE_STYLES[doc.source_type]?.label || doc.source_type) : 'Importado'}`}>
            <span>{doc.source_type ? (SOURCE_TYPE_STYLES[doc.source_type]?.icon || '📥') : '📥'}</span>
            {doc.source_type ? (SOURCE_TYPE_STYLES[doc.source_type]?.label || doc.source_type) : 'Importado'}
          </span>
          {doc.version_count && doc.version_count > 1 && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700" title={`${doc.version_count} versiones disponibles`}><History size={10} />v{doc.version_count}</span>}
          {getCategoryBadge(doc.category)}
          {doc.token_count && <span className="text-xs text-gray-400 whitespace-nowrap">{formatTokenCount(doc.token_count)}</span>}
        </div>
        {doc.tags && doc.tags.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {doc.tags.slice(0, 3).map((tag, idx) => (<button key={idx} onClick={() => setTagFilter(tag)} className={`px-1.5 py-0.5 text-[10px] rounded-full transition-colors ${tagFilter === tag ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`} title={`Filtrar por "${tag}"`}>{tag}</button>))}
            {doc.tags.length > 3 && <span className="text-[10px] text-gray-400">+{doc.tags.length - 3}</span>}
          </div>
        )}
        {campaigns.length > 0 && onCampaignChange && (
          <div className="hidden md:flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <Link2 size={12} className="text-gray-300" />
            <select value={doc.campaign_id || ''} onChange={(e) => handleCampaignChange(doc.id, e.target.value)} disabled={updatingDoc === doc.id} className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 max-w-[180px] truncate">
              <option value="">Documento global (todas las campañas)</option>
              {campaigns.map(campaign => (<option key={campaign.id} value={campaign.id}>{campaign.ecp_name}</option>))}
            </select>
            {updatingDoc === doc.id && <Loader2 size={12} className="text-gray-400 animate-spin" />}
          </div>
        )}
        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {onMoveToFolder && (
            <div className="relative">
              <button onClick={() => setFolderMenuDocId(folderMenuDocId === doc.id ? null : doc.id)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Mover a carpeta"><FolderInput size={16} /></button>
              {folderMenuDocId === doc.id && (
                <div className="absolute right-0 top-8 z-50 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2">
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100 mb-1">Mover a carpeta</div>
                  {doc.folder && <div className="px-3 py-1 text-xs text-gray-400 italic">Actual: {doc.folder}</div>}
                  {doc.folder && <button onClick={() => handleMoveToFolder(doc.id, null)} disabled={movingToFolder} className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"><X size={14} className="text-gray-400" /> Sin carpeta</button>}
                  {availableFolders.filter(f => f !== doc.folder).map(folder => (<button key={folder} onClick={() => handleMoveToFolder(doc.id, folder)} disabled={movingToFolder} className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-indigo-50 flex items-center gap-2 disabled:opacity-50"><FolderOpen size={14} className="text-indigo-500" /> {folder}</button>))}
                  {showNewFolderInput ? (
                    <div className="px-2 py-2 border-t border-gray-100 mt-1">
                      <input type="text" value={newFolderInput} onChange={(e) => setNewFolderInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolderAndMove(doc.id); if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderInput('') } }} placeholder="Nombre de carpeta..." className="w-full px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" autoFocus />
                      <div className="flex gap-1 mt-1.5">
                        <button onClick={() => handleCreateFolderAndMove(doc.id)} disabled={!newFolderInput.trim() || movingToFolder} className="flex-1 px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">{movingToFolder ? 'Moviendo...' : 'Crear y mover'}</button>
                        <button onClick={() => { setShowNewFolderInput(false); setNewFolderInput('') }} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowNewFolderInput(true)} className="w-full px-3 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 border-t border-gray-100 mt-1"><Plus size={14} /> Nueva carpeta...</button>
                  )}
                  <button onClick={() => { setFolderMenuDocId(null); setShowNewFolderInput(false); setNewFolderInput('') }} className="w-full px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 border-t border-gray-100 mt-1">Cerrar</button>
                </div>
              )}
            </div>
          )}
          {onEditDocument && <button onClick={() => onEditDocument(doc)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar documento"><Edit2 size={16} /></button>}
          <button onClick={() => onView(doc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Abrir en pantalla completa"><Maximize2 size={16} /></button>
          <button onClick={async () => { const confirmed = await modal.confirm({ title: 'Eliminar documento', message: `¿Eliminar "${doc.filename}"? Esta acción no se puede deshacer.`, confirmText: 'Eliminar', cancelText: 'Cancelar', variant: 'danger' }); if (confirmed) onDelete(doc.id) }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={16} /></button>
        </div>
      </div>
      {/* Description row */}
      {editingDescDocId === doc.id ? (
        <div className="mt-2 ml-8 px-3 pb-3 space-y-1.5">
          <textarea value={editingDescription} onChange={(e) => setEditingDescription(e.target.value)} onKeyDown={(e) => handleDescKeyDown(e, doc.id)} placeholder="Describe el contenido del documento..." rows={2} className="w-full px-2 py-1.5 text-xs border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 resize-none" autoFocus disabled={savingDescription} />
          <div className="flex items-center gap-2">
            <button onClick={() => handleSaveDescription(doc.id)} disabled={savingDescription} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1">{savingDescription ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Guardar</button>
            <button onClick={handleCancelDescEdit} disabled={savingDescription} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded disabled:opacity-50">Cancelar</button>
          </div>
        </div>
      ) : doc.description && !isExpanded ? (
        <div className="ml-8 px-3 pb-2 group/desc">
          <p className="text-xs text-gray-500 truncate max-w-2xl">
            {doc.description}
            {onUpdateDescription && <button onClick={() => handleStartDescEdit(doc)} className="ml-1.5 text-gray-400 hover:text-blue-600 opacity-0 group-hover/desc:opacity-100 transition-opacity" title="Editar descripcion"><Edit2 size={10} className="inline" /></button>}
          </p>
        </div>
      ) : onUpdateDescription && !isExpanded ? (
        <button onClick={() => handleStartDescEdit(doc)} className="ml-8 px-3 pb-2 text-[10px] text-gray-400 hover:text-blue-600">+ Descripción</button>
      ) : null}
      {/* Content match snippet */}
      {searchInContent && searchQuery && !isExpanded && (() => {
        const snippet = getContentMatchSnippet(doc.extracted_content, searchQuery)
        if (!snippet) return null
        const parts = snippet.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
        return (
          <div className="mx-3 mb-2 ml-8 p-1.5 bg-yellow-50 border border-yellow-100 rounded-lg text-xs text-gray-600">
            <span className="text-yellow-600 font-medium mr-1">Coincidencia:</span>
            {parts.map((part, i) => part.toLowerCase() === searchQuery.toLowerCase() ? <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark> : <span key={i}>{part}</span>)}
          </div>
        )
      })()}
      {/* Mobile: Tags & Campaign */}
      {!isExpanded && (
        <>
          <div className="sm:hidden px-3 pb-2 ml-5 flex flex-wrap items-center gap-1.5">
            {doc.tags && doc.tags.length > 0 && doc.tags.map((tag, idx) => (<button key={idx} onClick={() => setTagFilter(tag)} className={`px-1.5 py-0.5 text-[10px] rounded-full ${tagFilter === tag ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600'}`}>{tag}</button>))}
          </div>
          {campaigns.length > 0 && onCampaignChange && (
            <div className="md:hidden px-3 pb-2 ml-5 flex items-center gap-1.5">
              <Link2 size={11} className="text-gray-300" />
              <select value={doc.campaign_id || ''} onChange={(e) => handleCampaignChange(doc.id, e.target.value)} disabled={updatingDoc === doc.id} className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white">
                <option value="">Global (todas las campañas)</option>
                {campaigns.map(campaign => (<option key={campaign.id} value={campaign.id}>{campaign.ecp_name}</option>))}
              </select>
            </div>
          )}
        </>
      )}
      {/* Expanded content */}
      {isExpanded && doc.extracted_content && (
        <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <div className="p-3 max-h-[500px] overflow-hidden flex flex-col">
            {contentType === 'json' ? <JSONViewer content={doc.extracted_content} filename={doc.filename} />
              : contentType === 'csv' ? <CSVTableViewer content={doc.extracted_content} filename={doc.filename} />
              : <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white p-3 rounded-lg border border-gray-200 overflow-auto max-h-[450px]">{doc.extracted_content}</pre>}
          </div>
        </div>
      )}
    </>
  )

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

      {/* Context Lake Filters */}
      {showContextLakeFilters && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
          {/* Source Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Origen:</span>
            <select
              value={sourceTypeFilter}
              onChange={(e) => setSourceTypeFilter(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              {Object.entries(SOURCE_TYPE_STYLES).map(([key, style]) => (
                <option key={key} value={key}>
                  {style.icon} {style.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tier Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Tier:</span>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setTierFilter('all')}
                className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                  tierFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Todos
              </button>
              {(['T1', 'T2', 'T3'] as DocumentTier[]).map((tier) => {
                const style = TIER_STYLES[tier]
                return (
                  <button
                    key={tier}
                    onClick={() => setTierFilter(tier)}
                    title={style.description}
                    className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                      tierFilter === tier ? `${style.bg} ${style.text} shadow-sm` : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tier}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Shared/Project Filter */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {[
              { value: 'all', label: 'Todo' },
              { value: 'project', label: '📁 Proyecto' },
              { value: 'shared', label: '🔗 Compartido' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setSharedFilter(filter.value as typeof sharedFilter)}
                className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                  sharedFilter === filter.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results count */}
      {(searchQuery || categoryFilter !== 'all' || tagFilter !== 'all' || assignmentFilter !== 'all' || sourceTypeFilter !== 'all' || tierFilter !== 'all' || sharedFilter !== 'all') && (
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
            {tierFilter !== 'all' && (
              <span className="ml-1">
                tier <span className={`${TIER_STYLES[tierFilter as DocumentTier]?.bg} ${TIER_STYLES[tierFilter as DocumentTier]?.text} px-1.5 py-0.5 rounded text-xs`}>{tierFilter}</span>
              </span>
            )}
          </span>
          <button
            onClick={() => {
              setSearchQuery('')
              setCategoryFilter('all')
              setTagFilter('all')
              setAssignmentFilter('all')
              setSourceTypeFilter('all')
              setTierFilter('all')
              setSharedFilter('all')
            }}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Bulk Actions Toolbar */}
      {selectedDocs.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-medium text-blue-700">
            {selectedDocs.size} documento(s) seleccionado(s)
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5 font-medium"
          >
            {bulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Eliminar seleccionados
          </button>
          <button
            onClick={() => setSelectedDocs(new Set())}
            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-white/50 rounded-lg font-medium"
          >
            Cancelar selección
          </button>
        </div>
      )}

      {/* Select All Header */}
      {filteredDocs.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <input
            ref={selectAllRef}
            type="checkbox"
            onChange={toggleSelectAll}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs text-gray-500">
            {selectedDocs.size > 0
              ? `${selectedDocs.size} de ${filteredDocs.length} seleccionados`
              : 'Seleccionar todos'}
          </span>
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
              setSourceTypeFilter('all')
              setTierFilter('all')
              setSharedFilter('all')
            }}
            className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Limpiar filtros
          </button>
        </div>
      ) : groupByCompetitor && competitorGroups ? (
        <div className="space-y-3">
          {competitorGroups.map(([competitorName, docs]) => {
            const isGroupExpanded = expandedCompetitors.has(competitorName)
            const groupTokens = docs.reduce((sum, d) => sum + (d.token_count || 0), 0)
            return (
              <div key={competitorName} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleCompetitorGroup(competitorName)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-gray-400">
                    {isGroupExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </span>
                  <Users size={18} className="text-purple-500" />
                  <span className="font-medium text-sm text-gray-800">{competitorName}</span>
                  <span className="text-xs text-gray-400">
                    {docs.length} doc{docs.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {formatTokenCount(groupTokens)} tokens
                  </span>
                </button>
                {isGroupExpanded && (
                  <div className="space-y-2 p-2">
                    {docs.map((doc) => {
                      const isExpanded = expandedDocId === doc.id
                      const contentType = getContentType(doc.extracted_content)
                      return (
                        <div
                          key={doc.id}
                          className={`group bg-white border rounded-xl transition-all ${
                            isExpanded ? 'border-blue-200 shadow-sm' : 'border-gray-100 hover:border-blue-200 hover:shadow-sm'
                          }`}
                        >
                          {renderDocRow(doc, isExpanded, contentType)}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map((doc) => {
            const isExpanded = expandedDocId === doc.id
            const contentType = getContentType(doc.extracted_content)
            return (
              <div key={doc.id} className={`group bg-white border rounded-xl transition-all ${isExpanded ? 'border-blue-200 shadow-sm' : 'border-gray-100 hover:border-blue-200 hover:shadow-sm'}`}>
                {renderDocRow(doc, isExpanded, contentType)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
