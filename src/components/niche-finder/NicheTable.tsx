'use client'

import React, { useState, useMemo } from 'react'
import {
  Search,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import type { ExtractedNiche } from '@/types/scraper.types'

interface NicheTableProps {
  niches: ExtractedNiche[]
  onSelectNiche: (niche: ExtractedNiche | null) => void
  selectedNicheId?: string
}

type SortField = 'problem' | 'persona' | 'created_at'
type SortDirection = 'asc' | 'desc'

export default function NicheTable({
  niches,
  onSelectNiche,
  selectedNicheId,
}: NicheTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Filter and sort niches
  const filteredNiches = useMemo(() => {
    let result = [...niches]

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (niche) =>
          niche.problem?.toLowerCase().includes(term) ||
          niche.persona?.toLowerCase().includes(term) ||
          niche.functional_cause?.toLowerCase().includes(term)
      )
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField] || ''
      let bVal = b[sortField] || ''

      if (sortField === 'created_at') {
        aVal = new Date(aVal).getTime().toString()
        bVal = new Date(bVal).getTime().toString()
      }

      const comparison = aVal.localeCompare(bVal)
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return result
  }, [niches, searchTerm, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredNiches.length / itemsPerPage)
  const paginatedNiches = filteredNiches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
      <ChevronUp size={14} className="inline ml-1" />
    ) : (
      <ChevronDown size={14} className="inline ml-1" />
    )
  }

  if (niches.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <AlertCircle size={40} className="mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600">No se encontraron nichos</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header with search */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Buscar nichos..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <span className="text-sm text-gray-500">
            {filteredNiches.length} nichos
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('problem')}
              >
                Problema
                <SortIcon field="problem" />
              </th>
              <th
                className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('persona')}
              >
                Persona
                <SortIcon field="persona" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Causa
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-20">
                URL
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedNiches.map((niche) => (
              <tr
                key={niche.id}
                onClick={() => onSelectNiche(niche)}
                className={`
                  cursor-pointer transition-colors
                  ${
                    selectedNicheId === niche.id
                      ? 'bg-indigo-50'
                      : 'hover:bg-gray-50'
                  }
                `}
              >
                <td className="px-4 py-3 text-gray-900">
                  <div className="max-w-md">
                    {niche.problem?.substring(0, 100)}
                    {(niche.problem?.length || 0) > 100 ? '...' : ''}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  <div className="max-w-xs">
                    {niche.persona?.substring(0, 60)}
                    {(niche.persona?.length || 0) > 60 ? '...' : ''}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  <div className="max-w-xs">
                    {niche.functional_cause?.substring(0, 50)}
                    {(niche.functional_cause?.length || 0) > 50 ? '...' : ''}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {niche.source_url && (
                    <a
                      href={niche.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-indigo-600 hover:text-indigo-700"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
