'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Check, ArrowRight, Globe, ExternalLink } from 'lucide-react'

interface ScrapedUrl {
  id: string
  url: string
  title: string | null
  snippet: string | null
  source_type: string | null
  life_context: string
  product_word: string
  selected: boolean
}

interface UrlReviewViewProps {
  jobId: string
  onApprove: () => void
}

export default function UrlReviewView({ jobId, onApprove }: UrlReviewViewProps) {
  const [urls, setUrls] = useState<ScrapedUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  const fetchUrls = useCallback(async () => {
    try {
      const resp = await fetch(`/api/niche-finder/jobs/${jobId}/urls/scraped`)
      const data = await resp.json()
      if (data.success && data.urls) {
        setUrls(data.urls.map((u: ScrapedUrl) => ({ ...u, selected: u.selected !== false })))
      }
    } catch (err) {
      console.error('Error fetching URLs:', err)
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => { fetchUrls() }, [fetchUrls])

  const toggleUrl = (id: string) => {
    setUrls(prev => prev.map(u => u.id === id ? { ...u, selected: !u.selected } : u))
  }

  const selectAll = (selected: boolean) => {
    setUrls(prev => prev.map(u => {
      if (filter === 'all' || u.source_type === filter) {
        return { ...u, selected }
      }
      return u
    }))
  }

  const filteredUrls = filter === 'all' ? urls : urls.filter(u => u.source_type === filter)
  const selectedCount = urls.filter(u => u.selected).length
  const sourceTypes = [...new Set(urls.map(u => u.source_type).filter(Boolean))] as string[]

  const handleApprove = async () => {
    setSaving(true)
    try {
      // Save all selections
      const selectedIds = urls.filter(u => u.selected).map(u => u.id)
      const deselectedIds = urls.filter(u => !u.selected).map(u => u.id)

      // First deselect all, then select the chosen ones
      if (deselectedIds.length > 0) {
        await fetch(`/api/niche-finder/jobs/${jobId}/urls/selection`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urlIds: deselectedIds, selected: false }),
        })
      }

      if (selectedIds.length > 0) {
        await fetch(`/api/niche-finder/jobs/${jobId}/urls/selection`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urlIds: selectedIds, selected: true }),
        })
      }

      onApprove()
    } catch (err) {
      console.error('Error saving selection:', err)
    } finally {
      setSaving(false)
    }
  }

  const sourceLabel: Record<string, string> = {
    reddit: 'Reddit',
    thematic_forum: 'Foro Tem\u00e1tico',
    general_forum: 'Foro General',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-500">Cargando URLs...</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Selecci\u00f3n de URLs</h2>
        <p className="text-sm text-gray-500 mt-1">
          Selecciona las URLs relevantes para el an\u00e1lisis. {urls.length} URLs encontradas.
        </p>
      </div>

      {/* Filters + bulk actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
              filter === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas ({urls.length})
          </button>
          {sourceTypes.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                filter === type ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {sourceLabel[type] || type} ({urls.filter(u => u.source_type === type).length})
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => selectAll(true)}
            className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Seleccionar todas
          </button>
          <button
            onClick={() => selectAll(false)}
            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Deseleccionar
          </button>
        </div>
      </div>

      {/* URL list */}
      <div className="space-y-1 max-h-[55vh] overflow-y-auto border border-gray-200 rounded-lg">
        {filteredUrls.map(url => (
          <label
            key={url.id}
            className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${
              url.selected ? 'bg-white' : 'bg-gray-50 opacity-60'
            }`}
          >
            <input
              type="checkbox"
              checked={url.selected}
              onChange={() => toggleUrl(url.id)}
              className="mt-1 rounded border-gray-300"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900 truncate">
                  {url.title || url.url}
                </span>
                {url.source_type && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    url.source_type === 'reddit' ? 'bg-orange-100 text-orange-700'
                    : url.source_type === 'thematic_forum' ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}>
                    {sourceLabel[url.source_type] || url.source_type}
                  </span>
                )}
              </div>
              {url.snippet && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{url.snippet}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-gray-400 truncate max-w-xs">{url.url}</span>
                <a
                  href={url.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-gray-400 hover:text-blue-600"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Approve button */}
      <div className="flex justify-end">
        <button
          onClick={handleApprove}
          disabled={saving || selectedCount === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Analizar Seleccionadas ({selectedCount})
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
