'use client'

import { useState, useEffect, useMemo } from 'react'
import { DollarSign, TrendingUp, Clock, Cpu, BarChart3, Calendar, RefreshCcw, AlertTriangle, Zap, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface UsageLog {
  id: string
  model_used: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  cache_discount: number
  retrieval_mode: string
  duration_ms: number
  status: string
  created_at: string
  step_name?: string
}

interface UsageStats {
  totalCost: number
  todayCost: number
  weekCost: number
  monthCost: number
  totalRequests: number
  totalInputTokens: number
  totalOutputTokens: number
  avgCostPerRequest: number
  modelBreakdown: Record<string, { cost: number; requests: number; tokens: number }>
  ragVsFullSavings: { ragCost: number; fullCost: number; savedPercent: number }
}

interface UsageDashboardProps {
  userId?: string
  agencyId?: string
  showTitle?: boolean
  className?: string
}

export default function UsageDashboard({
  userId,
  agencyId,
  showTitle = true,
  className = '',
}: UsageDashboardProps) {
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'all'>('week')

  // Fetch usage logs
  useEffect(() => {
    async function fetchLogs() {
      setLoading(true)

      let query = supabase
        .from('openrouter_usage_logs')
        .select('*')
        .order('created_at', { ascending: false })

      if (userId) {
        query = query.eq('user_id', userId)
      }

      if (agencyId) {
        query = query.eq('agency_id', agencyId)
      }

      // Apply time filter
      const now = new Date()
      if (timeRange === 'day') {
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        query = query.gte('created_at', dayAgo.toISOString())
      } else if (timeRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        query = query.gte('created_at', weekAgo.toISOString())
      } else if (timeRange === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        query = query.gte('created_at', monthAgo.toISOString())
      }

      query = query.limit(500)

      const { data, error } = await query

      if (error) {
        console.error('Failed to fetch usage logs:', error)
      } else {
        setLogs(data || [])
      }

      setLoading(false)
    }

    fetchLogs()
  }, [userId, agencyId, timeRange])

  // Calculate stats
  const stats: UsageStats = useMemo(() => {
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    let totalCost = 0
    let todayCost = 0
    let weekCost = 0
    let monthCost = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let ragCost = 0
    let fullCost = 0

    const modelBreakdown: Record<string, { cost: number; requests: number; tokens: number }> = {}

    for (const log of logs) {
      const logDate = new Date(log.created_at)
      const cost = Number(log.cost_usd) || 0
      const tokens = (log.input_tokens || 0) + (log.output_tokens || 0)

      totalCost += cost
      totalInputTokens += log.input_tokens || 0
      totalOutputTokens += log.output_tokens || 0

      if (logDate >= dayAgo) todayCost += cost
      if (logDate >= weekAgo) weekCost += cost
      if (logDate >= monthAgo) monthCost += cost

      // Model breakdown
      const model = log.model_used || 'unknown'
      if (!modelBreakdown[model]) {
        modelBreakdown[model] = { cost: 0, requests: 0, tokens: 0 }
      }
      modelBreakdown[model].cost += cost
      modelBreakdown[model].requests += 1
      modelBreakdown[model].tokens += tokens

      // RAG vs Full comparison
      if (log.retrieval_mode === 'rag') {
        ragCost += cost
      } else {
        fullCost += cost
      }
    }

    const totalRequests = logs.length
    const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0
    const savedPercent = fullCost > 0 ? ((fullCost - ragCost) / fullCost) * 100 : 0

    return {
      totalCost,
      todayCost,
      weekCost,
      monthCost,
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      avgCostPerRequest,
      modelBreakdown,
      ragVsFullSavings: { ragCost, fullCost, savedPercent },
    }
  }, [logs])

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`
    if (cost < 1) return `$${cost.toFixed(3)}`
    return `$${cost.toFixed(2)}`
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
    return tokens.toString()
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {showTitle && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 size={20} className="text-indigo-500" />
            Dashboard de Costos OpenRouter
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
              className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="day">Hoy</option>
              <option value="week">Esta semana</option>
              <option value="month">Este mes</option>
              <option value="all">Todo</option>
            </select>
            <button
              onClick={() => setLogs([...logs])} // Trigger refresh
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refrescar"
            >
              <RefreshCcw size={16} />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <>
          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Cost */}
            <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-indigo-600 mb-2">
                <DollarSign size={18} />
                <span className="text-xs font-medium uppercase tracking-wide">Costo Total</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCost(stats.totalCost)}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.totalRequests} ejecuciones</p>
            </div>

            {/* Today Cost */}
            <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <Calendar size={18} />
                <span className="text-xs font-medium uppercase tracking-wide">Hoy</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCost(stats.todayCost)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {logs.filter(l => new Date(l.created_at) >= new Date(Date.now() - 24*60*60*1000)).length} ejecuciones
              </p>
            </div>

            {/* This Week */}
            <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <TrendingUp size={18} />
                <span className="text-xs font-medium uppercase tracking-wide">Semana</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCost(stats.weekCost)}</p>
              <p className="text-xs text-gray-500 mt-1">Promedio: {formatCost(stats.avgCostPerRequest)}/req</p>
            </div>

            {/* Tokens */}
            <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <Cpu size={18} />
                <span className="text-xs font-medium uppercase tracking-wide">Tokens</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatTokens(stats.totalInputTokens + stats.totalOutputTokens)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                In: {formatTokens(stats.totalInputTokens)} / Out: {formatTokens(stats.totalOutputTokens)}
              </p>
            </div>
          </div>

          {/* RAG vs Full Comparison */}
          {(stats.ragVsFullSavings.ragCost > 0 || stats.ragVsFullSavings.fullCost > 0) && (
            <div className="bg-gradient-to-br from-cyan-50 to-white border border-cyan-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Zap size={18} className="text-cyan-500" />
                RAG vs Documento Completo
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-cyan-600 mb-1">
                    <Zap size={14} />
                    <span className="text-xs font-medium">RAG</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{formatCost(stats.ragVsFullSavings.ragCost)}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                    <FileText size={14} />
                    <span className="text-xs font-medium">Completo</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{formatCost(stats.ragVsFullSavings.fullCost)}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                    <TrendingUp size={14} />
                    <span className="text-xs font-medium">Ahorro</span>
                  </div>
                  <p className="text-xl font-bold text-green-600">
                    {stats.ragVsFullSavings.savedPercent > 0
                      ? `${stats.ragVsFullSavings.savedPercent.toFixed(0)}%`
                      : '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Model Breakdown */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Cpu size={18} className="text-gray-500" />
              Desglose por Modelo
            </h3>
            {Object.keys(stats.modelBreakdown).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No hay datos de uso</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.modelBreakdown)
                  .sort((a, b) => b[1].cost - a[1].cost)
                  .map(([model, data]) => {
                    const percentage = stats.totalCost > 0 ? (data.cost / stats.totalCost) * 100 : 0
                    return (
                      <div key={model} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-900 truncate max-w-[200px]" title={model}>
                            {model.replace('google/', '').replace('openai/', '').replace('anthropic/', '')}
                          </span>
                          <div className="flex items-center gap-3 text-gray-600">
                            <span>{formatTokens(data.tokens)} tokens</span>
                            <span>{data.requests} req</span>
                            <span className="font-medium">{formatCost(data.cost)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={18} className="text-gray-500" />
              Actividad Reciente
            </h3>
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No hay actividad reciente</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {logs.slice(0, 20).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full ${
                        log.status === 'success' ? 'bg-green-500' :
                        log.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                      }`} />
                      <span className="text-gray-900 truncate">
                        {log.step_name || 'Step'}
                      </span>
                      <span className="text-xs text-gray-500 truncate max-w-[150px]" title={log.model_used}>
                        {log.model_used?.replace('google/', '').replace('openai/', '').split('/').pop()}
                      </span>
                      {log.retrieval_mode === 'rag' && (
                        <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded">RAG</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-gray-600">
                      <span className="text-xs">{formatTokens((log.input_tokens || 0) + (log.output_tokens || 0))}</span>
                      <span className="font-medium">{formatCost(log.cost_usd)}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(log.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warning if high costs */}
          {stats.todayCost > 10 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Alto consumo detectado</p>
                <p className="text-sm text-amber-700 mt-1">
                  Has gastado {formatCost(stats.todayCost)} hoy. Considera usar RAG para reducir costos
                  o cambiar a modelos mas economicos como Gemini Flash.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
