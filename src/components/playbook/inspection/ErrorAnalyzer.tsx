'use client'

import { StepDefinition } from '../types'

export interface ErrorAction {
  label: string
  type: 'navigate' | 'retry' | 'configure' | 'external'
  href?: string // For navigate type
  onClick?: () => void // For custom actions
}

export interface ErrorAnalysis {
  category: 'api_key' | 'timeout' | 'network' | 'validation' | 'job_failed' | 'rate_limit' | 'unknown'
  humanMessage: string
  suggestion: string
  service?: string
  actions: ErrorAction[]
}

// Extract service name from error message
function extractServiceFromError(error: string): string {
  const lowerError = error.toLowerCase()

  if (lowerError.includes('openrouter')) return 'OpenRouter'
  if (lowerError.includes('serper')) return 'Serper'
  if (lowerError.includes('firecrawl')) return 'Firecrawl'
  if (lowerError.includes('openai')) return 'OpenAI'
  if (lowerError.includes('anthropic')) return 'Anthropic'
  if (lowerError.includes('blotato')) return 'Blotato'
  if (lowerError.includes('wavespeed')) return 'WaveSpeed'

  // Try to extract from "X API key" pattern
  const match = error.match(/(\w+)\s*api\s*key/i)
  if (match) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
  }

  return 'API'
}

export function analyzeError(error: string, step?: StepDefinition): ErrorAnalysis {
  const errorLower = error.toLowerCase()

  // API Key errors
  if (
    errorLower.includes('api key') ||
    errorLower.includes('not configured') ||
    errorLower.includes('missing key') ||
    errorLower.includes('unauthorized') ||
    errorLower.includes('missing_api_key')
  ) {
    const service = extractServiceFromError(error)
    return {
      category: 'api_key',
      humanMessage: `Falta configurar la API key de ${service}`,
      suggestion: 'Configura tu API key en Ajustes para continuar con este paso.',
      service,
      actions: [
        {
          label: 'Configurar API Key',
          type: 'navigate',
          href: '?tab=setup',
        },
        {
          label: 'Reintentar',
          type: 'retry',
        },
      ],
    }
  }

  // Rate limit errors
  if (
    errorLower.includes('rate limit') ||
    errorLower.includes('too many requests') ||
    errorLower.includes('429')
  ) {
    return {
      category: 'rate_limit',
      humanMessage: 'Límite de solicitudes excedido',
      suggestion: 'El servicio está limitando las solicitudes. Espera unos segundos y reintenta.',
      actions: [
        {
          label: 'Reintentar en 30s',
          type: 'retry',
        },
      ],
    }
  }

  // Timeout errors
  if (
    errorLower.includes('timeout') ||
    errorLower.includes('timed out') ||
    errorLower.includes('aborted')
  ) {
    return {
      category: 'timeout',
      humanMessage: 'La operación tardó demasiado',
      suggestion: 'El servidor no respondió a tiempo. Esto puede pasar con operaciones grandes.',
      actions: [
        {
          label: 'Reintentar',
          type: 'retry',
        },
      ],
    }
  }

  // Network errors
  if (
    errorLower.includes('network') ||
    errorLower.includes('fetch failed') ||
    errorLower.includes('connection') ||
    errorLower.includes('econnrefused')
  ) {
    return {
      category: 'network',
      humanMessage: 'Error de conexión',
      suggestion: 'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
      actions: [
        {
          label: 'Reintentar',
          type: 'retry',
        },
      ],
    }
  }

  // Validation errors
  if (
    errorLower.includes('invalid') ||
    errorLower.includes('validation') ||
    errorLower.includes('required')
  ) {
    return {
      category: 'validation',
      humanMessage: 'Error de validación',
      suggestion: 'Los datos enviados no son válidos. Revisa la configuración del paso.',
      actions: [
        {
          label: 'Revisar configuración',
          type: 'navigate',
          href: '?tab=setup',
        },
      ],
    }
  }

  // Job specific errors
  if (step?.executor === 'job') {
    return {
      category: 'job_failed',
      humanMessage: 'El job falló durante la ejecución',
      suggestion: 'Revisa el estado del job para más detalles sobre el error.',
      actions: [
        {
          label: 'Ver detalles',
          type: 'external',
        },
        {
          label: 'Reintentar',
          type: 'retry',
        },
      ],
    }
  }

  // Unknown/default error
  return {
    category: 'unknown',
    humanMessage: 'Ocurrió un error inesperado',
    suggestion: error,
    actions: [
      {
        label: 'Reintentar',
        type: 'retry',
      },
    ],
  }
}

// Get color classes for error category
export function getErrorCategoryColor(category: ErrorAnalysis['category']): string {
  switch (category) {
    case 'api_key':
      return 'bg-amber-50 border-amber-200 text-amber-800'
    case 'rate_limit':
      return 'bg-orange-50 border-orange-200 text-orange-800'
    case 'timeout':
      return 'bg-yellow-50 border-yellow-200 text-yellow-800'
    case 'network':
      return 'bg-red-50 border-red-200 text-red-800'
    case 'validation':
      return 'bg-purple-50 border-purple-200 text-purple-800'
    case 'job_failed':
      return 'bg-red-50 border-red-200 text-red-800'
    default:
      return 'bg-red-50 border-red-200 text-red-800'
  }
}
