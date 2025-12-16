'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { formatTokenCount, checkTokenLimits, TOKEN_LIMITS } from '@/lib/supabase'

interface TokenMonitorProps {
  totalTokens: number
  breakdown?: {
    label: string
    tokens: number
  }[]
}

export default function TokenMonitor({
  totalTokens,
  breakdown,
}: TokenMonitorProps) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const limits = checkTokenLimits(totalTokens)

  const getStatusConfig = () => {
    if (limits.isOverLimit) {
      return {
        icon: AlertCircle,
        iconColor: 'text-red-500',
        bgColor: 'bg-gradient-to-r from-red-50 to-orange-50',
        borderColor: 'border-red-200',
        barColor: 'bg-red-500',
        textColor: 'text-red-700',
        label: 'Límite excedido',
      }
    }
    if (limits.shouldWarn) {
      return {
        icon: AlertTriangle,
        iconColor: 'text-yellow-500',
        bgColor: 'bg-gradient-to-r from-yellow-50 to-amber-50',
        borderColor: 'border-yellow-200',
        barColor: 'bg-yellow-500',
        textColor: 'text-yellow-700',
        label: 'Cerca del límite',
      }
    }
    return {
      icon: CheckCircle,
      iconColor: 'text-green-500',
      bgColor: 'bg-gradient-to-r from-green-50 to-emerald-50',
      borderColor: 'border-green-200',
      barColor: 'bg-green-500',
      textColor: 'text-green-700',
      label: 'Dentro del límite',
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  // Sort breakdown by tokens descending
  const sortedBreakdown = breakdown?.slice().sort((a, b) => b.tokens - a.tokens) || []
  const maxTokens = sortedBreakdown[0]?.tokens || 1

  return (
    <div className={`${config.bgColor} border ${config.borderColor} rounded-2xl p-4 transition-all`}>
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-xl ${config.bgColor}`}>
          <Zap className={`w-5 h-5 ${config.iconColor}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                Monitor de Tokens
                <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.textColor} font-medium`}>
                  {config.label}
                </span>
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                <span className="font-semibold">{formatTokenCount(totalTokens)}</span>
                <span className="text-gray-400 mx-1">/</span>
                <span>{formatTokenCount(TOKEN_LIMITS.MAX_LIMIT)}</span>
                <span className="text-gray-400 ml-2">({limits.percentage}%)</span>
              </p>
            </div>
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>

          {/* Progress Bar */}
          <div className="relative h-2.5 bg-gray-200 rounded-full overflow-hidden">
            {/* Warning threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10"
              style={{ left: '80%' }}
            />
            <div
              className={`h-full ${config.barColor} rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(limits.percentage, 100)}%` }}
            />
          </div>

          {/* Warning Messages */}
          {limits.isOverLimit && (
            <div className="mt-3 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>El contexto excede el límite de 2M tokens. Reduce documentos.</span>
            </div>
          )}

          {limits.shouldWarn && !limits.isOverLimit && (
            <div className="mt-3 flex items-start gap-2 text-sm text-yellow-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Te acercas al límite ({limits.percentage}% usado).</span>
            </div>
          )}

          {/* Breakdown Toggle */}
          {sortedBreakdown.length > 0 && (
            <button
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="mt-3 flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {showBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showBreakdown ? 'Ocultar desglose' : 'Ver desglose por documento'}
            </button>
          )}

          {/* Breakdown List */}
          {showBreakdown && sortedBreakdown.length > 0 && (
            <div className="mt-3 space-y-2 bg-white/50 rounded-xl p-3">
              {sortedBreakdown.map((item, idx) => {
                const percentage = (item.tokens / maxTokens) * 100
                return (
                  <div key={idx} className="group">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700 truncate flex-1 mr-2">{item.label}</span>
                      <span className="font-mono text-gray-500">{formatTokenCount(item.tokens)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full transition-all group-hover:bg-blue-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
