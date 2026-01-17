'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, FolderOpen, Folder, Plus, X, Link2 } from 'lucide-react'
import { Document, groupByFolder, getFolderDisplayName, getFolders } from '@/hooks/useDocuments'

interface DocumentFolderViewProps {
  documents: Document[]
  onFolderClick?: (folder: string | null) => void
  onDocumentClick?: (doc: Document) => void
  onCreateFolder?: (folderName: string) => void
  selectedDocIds?: Set<string>
  onToggleDocSelection?: (docId: string) => void
  showCreateFolder?: boolean
  emptyMessage?: string
}

export default function DocumentFolderView({
  documents,
  onFolderClick,
  onDocumentClick,
  onCreateFolder,
  selectedDocIds,
  onToggleDocSelection,
  showCreateFolder = false,
  emptyMessage = 'No hay documentos',
}: DocumentFolderViewProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['__uncategorized__']))
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Group documents by folder
  const groupedDocs = useMemo(() => groupByFolder(documents), [documents])
  const folders = useMemo(() => getFolders(documents), [documents])

  // Sort folders: named folders first (alphabetically), then uncategorized
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

  const handleCreateFolder = () => {
    if (!newFolderName.trim() || !onCreateFolder) return
    onCreateFolder(newFolderName.trim())
    setNewFolderName('')
    setCreatingFolder(false)
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block p-4 bg-gray-100 rounded-2xl mb-4">
          <FolderOpen className="w-10 h-10 text-gray-400" />
        </div>
        <p className="text-gray-500 text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Create folder button/input */}
      {showCreateFolder && onCreateFolder && (
        <div className="mb-4">
          {creatingFolder ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') {
                    setCreatingFolder(false)
                    setNewFolderName('')
                  }
                }}
                placeholder="Nombre de la carpeta..."
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Crear
              </button>
              <button
                onClick={() => {
                  setCreatingFolder(false)
                  setNewFolderName('')
                }}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingFolder(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus size={16} />
              Nueva carpeta
            </button>
          )}
        </div>
      )}

      {/* Folder list */}
      {sortedFolderKeys.map((folder) => {
        const docs = groupedDocs[folder]
        const isExpanded = expandedFolders.has(folder)
        const folderName = getFolderDisplayName(folder)
        const isUncategorized = folder === '__uncategorized__'

        return (
          <div key={folder} className="border border-gray-100 rounded-xl overflow-hidden">
            {/* Folder header */}
            <button
              onClick={() => toggleFolder(folder)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="text-gray-400">
                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </span>
              <span className="text-gray-500">
                {isUncategorized ? <FolderOpen size={18} /> : <Folder size={18} />}
              </span>
              <span className={`font-medium text-sm ${isUncategorized ? 'text-gray-500 italic' : 'text-gray-700'}`}>
                {folderName}
              </span>
              <span className="text-xs text-gray-400 ml-1">
                ({docs.length})
              </span>
              {onFolderClick && !isUncategorized && (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    onFolderClick(folder)
                  }}
                  className="ml-auto text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Ver todos
                </span>
              )}
            </button>

            {/* Document list */}
            {isExpanded && (
              <div className="divide-y divide-gray-50">
                {docs.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    onClick={onDocumentClick}
                    isSelected={selectedDocIds?.has(doc.id)}
                    onToggleSelect={onToggleDocSelection}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Show existing folder names for reference */}
      {showCreateFolder && folders.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">Carpetas existentes:</p>
          <div className="flex flex-wrap gap-1">
            {folders.map((folder) => (
              <span
                key={folder}
                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
              >
                {folder}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Individual document row component
interface DocumentRowProps {
  doc: Document
  onClick?: (doc: Document) => void
  isSelected?: boolean
  onToggleSelect?: (docId: string) => void
}

function DocumentRow({ doc, onClick, isSelected, onToggleSelect }: DocumentRowProps) {
  const isReference = doc.is_reference && doc.source_doc_id

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/50 transition-colors cursor-pointer ${
        isSelected ? 'bg-blue-50' : ''
      }`}
      onClick={() => onClick?.(doc)}
    >
      {/* Selection checkbox */}
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            onToggleSelect(doc.id)
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
        />
      )}

      {/* Reference indicator */}
      {isReference && (
        <span className="flex-shrink-0 text-indigo-500" title="Referencia a Context Lake">
          <Link2 size={14} />
        </span>
      )}

      {/* Filename */}
      <span className="flex-1 text-sm text-gray-700 truncate">
        {doc.filename}
      </span>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Reference badge */}
        {isReference && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded">
            Ref
          </span>
        )}

        {/* Category badge */}
        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
          doc.category === 'product' ? 'bg-blue-50 text-blue-600' :
          doc.category === 'competitor' ? 'bg-purple-50 text-purple-600' :
          doc.category === 'research' ? 'bg-green-50 text-green-600' :
          doc.category === 'output' ? 'bg-orange-50 text-orange-600' :
          'bg-gray-50 text-gray-600'
        }`}>
          {doc.category}
        </span>

        {/* Size/tokens */}
        {doc.token_count && (
          <span className="text-[10px] text-gray-400">
            {doc.token_count > 1000
              ? `${(doc.token_count / 1000).toFixed(1)}k`
              : doc.token_count} tokens
          </span>
        )}
      </div>
    </div>
  )
}
