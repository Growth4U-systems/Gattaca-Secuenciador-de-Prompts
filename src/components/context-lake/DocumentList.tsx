'use client'

import { useState } from 'react'
import { Search, Filter, SortAsc, SortDesc, Loader2 } from 'lucide-react'
import type { Document, DocumentTier, ApprovalStatus } from '@/types/v2.types'
import { TIER_CONFIG, DOCUMENT_TYPES } from '@/types/v2.types'
import DocumentCard from './DocumentCard'

interface DocumentListProps {
  documents: Document[]
  loading?: boolean
  onEdit?: (doc: Document) => void
  onDelete?: (doc: Document) => void
  onApprove?: (doc: Document) => void
  onArchive?: (doc: Document) => void
  onUpdated?: () => void
}

type SortField = 'authority_score' | 'created_at' | 'updated_at' | 'title'

export default function DocumentList({
  documents,
  loading = false,
  onEdit,
  onDelete,
  onApprove,
  onArchive,
  onUpdated,
}: DocumentListProps) {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<DocumentTier | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('all')
  const [sortField, setSortField] = useState<SortField>('authority_score')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)

  // Filter documents
  const filteredDocs = documents.filter((doc) => {
    if (search && !doc.title.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    if (tierFilter !== 'all' && doc.tier !== tierFilter) {
      return false
    }
    if (typeFilter !== 'all' && doc.document_type !== typeFilter) {
      return false
    }
    if (statusFilter !== 'all' && doc.approval_status !== statusFilter) {
      return false
    }
    return true
  })

  // Sort documents
  const sortedDocs = [...filteredDocs].sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case 'authority_score':
        comparison = (a.authority_score || 0) - (b.authority_score || 0)
        break
      case 'title':
        comparison = a.title.localeCompare(b.title)
        break
      case 'created_at':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
      case 'updated_at':
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        break
    }
    return sortOrder === 'asc' ? comparison : -comparison
  })

  // Get unique document types from current documents
  const docTypes = [...new Set(documents.map((d) => d.document_type))]

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar documentos..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
            showFilters || tierFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter size={16} />
          Filtros
        </button>

        {/* Sort */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['authority_score', 'created_at', 'title'] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                sortField === field
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {field === 'authority_score' && 'Autoridad'}
              {field === 'created_at' && 'Fecha'}
              {field === 'title' && 'Nombre'}
              {sortField === field && (
                sortOrder === 'desc' ? <SortDesc size={12} /> : <SortAsc size={12} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
          {/* Tier filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Tier:</span>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value) as DocumentTier)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              {([1, 2, 3] as DocumentTier[]).map((tier) => (
                <option key={tier} value={tier}>
                  {TIER_CONFIG[tier].name}
                </option>
              ))}
            </select>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Tipo:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              {docTypes.map((type) => (
                <option key={type} value={type}>
                  {DOCUMENT_TYPES.find((t) => t.value === type)?.label || type}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ApprovalStatus | 'all')}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="draft">Borrador</option>
              <option value="approved">Aprobado</option>
              <option value="archived">Archivado</option>
            </select>
          </div>

          {/* Clear filters */}
          {(tierFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setTierFilter('all')
                setTypeFilter('all')
                setStatusFilter('all')
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-gray-500">
        {sortedDocs.length} de {documents.length} documentos
      </div>

      {/* Document grid */}
      {sortedDocs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-gray-500">No se encontraron documentos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onEdit={onEdit}
              onDelete={onDelete}
              onApprove={onApprove}
              onArchive={onArchive}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}
