'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, X, ChevronDown, ChevronRight, Folder, FolderOpen, Link2, FileText, Check } from 'lucide-react'
import { Document, groupByFolder, getFolderDisplayName, useDocuments, useClientDocuments } from '@/hooks/useDocuments'

type TabType = 'project' | 'context-lake' | 'all'

interface DocumentSelectorProps {
  projectId: string
  clientId: string
  selectedDocIds: string[]
  onSelectionChange: (docIds: string[]) => void
  onClose?: () => void
  title?: string
  maxSelections?: number
  allowContextLake?: boolean
}

export default function DocumentSelector({
  projectId,
  clientId,
  selectedDocIds,
  onSelectionChange,
  onClose,
  title = 'Seleccionar Documentos',
  maxSelections,
  allowContextLake = true,
}: DocumentSelectorProps) {
  const [activeTab, setActiveTab] = useState<TabType>('project')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['__uncategorized__']))

  // Fetch documents
  const { documents: projectDocs, loading: loadingProject } = useDocuments(projectId)
  const { documents: contextLakeDocs, loading: loadingContextLake } = useClientDocuments(clientId)

  // Get documents based on active tab
  const visibleDocs = useMemo(() => {
    let docs: Document[] = []

    switch (activeTab) {
      case 'project':
        docs = projectDocs
        break
      case 'context-lake':
        docs = contextLakeDocs.map(doc => ({ ...doc, isShared: true }))
        break
      case 'all':
        docs = [
          ...projectDocs,
          ...contextLakeDocs.map(doc => ({ ...doc, isShared: true }))
        ]
        break
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      docs = docs.filter(doc =>
        doc.filename.toLowerCase().includes(query) ||
        doc.description?.toLowerCase().includes(query) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    return docs
  }, [activeTab, projectDocs, contextLakeDocs, searchQuery])

  // Group by folder
  const groupedDocs = useMemo(() => groupByFolder(visibleDocs), [visibleDocs])

  // Sort folder keys
  const sortedFolderKeys = useMemo(() => {
    const keys = Object.keys(groupedDocs)
    return keys.sort((a, b) => {
      if (a === '__uncategorized__') return 1
      if (b === '__uncategorized__') return -1
      return a.localeCompare(b)
    })
  }, [groupedDocs])

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folder)) {
        next.delete(folder)
      } else {
        next.add(folder)
      }
      return next
    })
  }

  const toggleDocSelection = useCallback((docId: string) => {
    const isSelected = selectedDocIds.includes(docId)

    if (isSelected) {
      onSelectionChange(selectedDocIds.filter(id => id !== docId))
    } else {
      if (maxSelections && selectedDocIds.length >= maxSelections) {
        // Replace last selection if at max
        onSelectionChange([...selectedDocIds.slice(0, -1), docId])
      } else {
        onSelectionChange([...selectedDocIds, docId])
      }
    }
  }, [selectedDocIds, onSelectionChange, maxSelections])

  const selectAll = () => {
    const allIds = visibleDocs.map(d => d.id)
    if (maxSelections) {
      onSelectionChange(allIds.slice(0, maxSelections))
    } else {
      onSelectionChange(allIds)
    }
  }

  const clearSelection = () => {
    onSelectionChange([])
  }

  const loading = loadingProject || loadingContextLake

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 bg-white">
        <button
          onClick={() => setActiveTab('project')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'project'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <FileText size={14} />
            Este Proyecto
          </span>
        </button>

        {allowContextLake && (
          <button
            onClick={() => setActiveTab('context-lake')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'context-lake'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Link2 size={14} />
              Context Lake
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'all'
              ? 'bg-purple-100 text-purple-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Todos
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-gray-100">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar documentos..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Selection info & actions */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
        <span className="text-xs text-gray-500">
          {selectedDocIds.length} seleccionado(s)
          {maxSelections && ` (máx. ${maxSelections})`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Seleccionar visibles
          </button>
          {selectedDocIds.length > 0 && (
            <button
              onClick={clearSelection}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : visibleDocs.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {searchQuery ? 'No hay documentos que coincidan' : 'No hay documentos disponibles'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedFolderKeys.map((folder) => {
              const docs = groupedDocs[folder]
              const isExpanded = expandedFolders.has(folder)
              const folderName = getFolderDisplayName(folder)
              const isUncategorized = folder === '__uncategorized__'
              const selectedInFolder = docs.filter(d => selectedDocIds.includes(d.id)).length

              return (
                <div key={folder}>
                  {/* Folder header */}
                  <button
                    onClick={() => toggleFolder(folder)}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-gray-400">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <span className="text-gray-400">
                      {isUncategorized ? <FolderOpen size={16} /> : <Folder size={16} />}
                    </span>
                    <span className={`text-sm font-medium ${isUncategorized ? 'text-gray-500 italic' : 'text-gray-700'}`}>
                      {folderName}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({docs.length})
                    </span>
                    {selectedInFolder > 0 && (
                      <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        {selectedInFolder} sel.
                      </span>
                    )}
                  </button>

                  {/* Documents */}
                  {isExpanded && (
                    <div className="bg-white">
                      {docs.map((doc) => {
                        const isSelected = selectedDocIds.includes(doc.id)
                        const isReference = doc.is_reference && doc.source_doc_id

                        return (
                          <div
                            key={doc.id}
                            onClick={() => toggleDocSelection(doc.id)}
                            className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-50 hover:bg-blue-100'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            {/* Checkbox */}
                            <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-gray-300 hover:border-blue-400'
                            }`}>
                              {isSelected && <Check size={14} className="text-white" />}
                            </div>

                            {/* Context Lake indicator */}
                            {doc.isShared && (
                              <span className="flex-shrink-0 text-indigo-500" title="Del Context Lake">
                                <Link2 size={14} />
                              </span>
                            )}

                            {/* Reference indicator */}
                            {isReference && !doc.isShared && (
                              <span className="flex-shrink-0 text-indigo-400" title="Referencia">
                                <Link2 size={12} />
                              </span>
                            )}

                            {/* Filename */}
                            <span className="flex-1 text-sm text-gray-700 truncate">
                              {doc.filename}
                            </span>

                            {/* Badges */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                doc.category === 'product' ? 'bg-blue-50 text-blue-600' :
                                doc.category === 'competitor' ? 'bg-purple-50 text-purple-600' :
                                doc.category === 'research' ? 'bg-green-50 text-green-600' :
                                doc.category === 'output' ? 'bg-orange-50 text-orange-600' :
                                'bg-gray-50 text-gray-600'
                              }`}>
                                {doc.category}
                              </span>

                              {doc.token_count && (
                                <span className="text-[10px] text-gray-400">
                                  {doc.token_count > 1000
                                    ? `${(doc.token_count / 1000).toFixed(1)}k`
                                    : doc.token_count}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {onClose && (
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={onClose}
            disabled={selectedDocIds.length === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar ({selectedDocIds.length})
          </button>
        </div>
      )}
    </div>
  )
}
