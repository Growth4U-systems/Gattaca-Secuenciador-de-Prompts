'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Settings,
  Save,
  RotateCcw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
} from 'lucide-react'
import type { FoundationalType, FoundationalTransformer } from '@/types/v2.types'
import { FOUNDATIONAL_TYPE_CONFIG } from '@/types/v2.types'

interface TransformerConfigProps {
  agencyId: string
}

interface TransformerFormData {
  prompt: string
  model: string
  temperature: number
  max_tokens: number
}

const DEFAULT_MODELS = [
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4 (Recomendado)' },
  { value: 'anthropic/claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'openai/gpt-4o', label: 'GPT-4o' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'google/gemini-pro-1.5', label: 'Gemini Pro 1.5' },
]

const FOUNDATIONAL_TYPES: FoundationalType[] = [
  'brand_dna',
  'icp',
  'tone_of_voice',
  'product_docs',
  'pricing',
  'competitor_analysis',
]

export default function TransformerConfig({ agencyId }: TransformerConfigProps) {
  const [transformers, setTransformers] = useState<Record<FoundationalType, TransformerFormData>>({} as any)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<FoundationalType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<FoundationalType | null>(null)
  const [expandedType, setExpandedType] = useState<FoundationalType | null>('brand_dna')

  // Fetch transformers for agency
  const fetchTransformers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/v2/transformers?agencyId=${agencyId}`)
      if (!response.ok) throw new Error('Failed to fetch transformers')

      const data = await response.json()

      // Initialize with defaults or fetched data
      const transformerMap: Record<FoundationalType, TransformerFormData> = {} as any

      for (const type of FOUNDATIONAL_TYPES) {
        const existing = data.transformers?.find((t: any) => t.foundational_type === type)
        transformerMap[type] = {
          prompt: existing?.prompt || getDefaultPrompt(type),
          model: existing?.model || 'anthropic/claude-sonnet-4',
          temperature: existing?.temperature ?? 0.3,
          max_tokens: existing?.max_tokens ?? 8000,
        }
      }

      setTransformers(transformerMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading transformers')
    } finally {
      setLoading(false)
    }
  }, [agencyId])

  useEffect(() => {
    if (agencyId) {
      fetchTransformers()
    }
  }, [agencyId, fetchTransformers])

  // Save transformer
  const handleSave = async (type: FoundationalType) => {
    try {
      setSaving(type)
      setError(null)
      setSuccess(null)

      const formData = transformers[type]

      const response = await fetch('/api/v2/transformers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId,
          foundationalType: type,
          prompt: formData.prompt,
          model: formData.model,
          temperature: formData.temperature,
          maxTokens: formData.max_tokens,
        }),
      })

      if (!response.ok) throw new Error('Failed to save transformer')

      setSuccess(type)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving transformer')
    } finally {
      setSaving(null)
    }
  }

  // Reset to default
  const handleReset = (type: FoundationalType) => {
    setTransformers(prev => ({
      ...prev,
      [type]: {
        prompt: getDefaultPrompt(type),
        model: 'anthropic/claude-sonnet-4',
        temperature: 0.3,
        max_tokens: 8000,
      },
    }))
  }

  // Update field
  const updateField = (type: FoundationalType, field: keyof TransformerFormData, value: any) => {
    setTransformers(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
      },
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Configuración de Transformers</h2>
            <p className="text-indigo-200 text-sm">
              Personaliza los prompts que generan cada documento fundacional
            </p>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">¿Cómo funcionan los transformers?</p>
          <p className="text-blue-700">
            Cada transformer tiene un prompt que define cómo sintetizar los documentos fuente en un documento fundacional.
            El placeholder <code className="bg-blue-100 px-1 rounded">{'{{sources}}'}</code> se reemplaza automáticamente
            con el contenido de los documentos asignados.
          </p>
        </div>
      </div>

      {/* Transformer Cards */}
      <div className="space-y-4">
        {FOUNDATIONAL_TYPES.map(type => {
          const config = FOUNDATIONAL_TYPE_CONFIG[type]
          const formData = transformers[type]
          const isExpanded = expandedType === type
          const isSaving = saving === type
          const isSuccess = success === type

          return (
            <div
              key={type}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => setExpandedType(isExpanded ? null : type)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{config.label}</h3>
                    <p className="text-xs text-gray-500">Tier {config.tier}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSuccess && (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Guardado
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && formData && (
                <div className="border-t border-gray-200 p-4 space-y-4">
                  {/* Model Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Modelo
                    </label>
                    <select
                      value={formData.model}
                      onChange={(e) => updateField(type, 'model', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {DEFAULT_MODELS.map(model => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Temperature & Max Tokens */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Temperatura
                        <span className="ml-1 text-gray-400 font-normal">(0-2)</span>
                      </label>
                      <input
                        type="number"
                        value={formData.temperature}
                        onChange={(e) => updateField(type, 'temperature', parseFloat(e.target.value))}
                        min="0"
                        max="2"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Menor = más consistente, Mayor = más creativo
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Tokens
                      </label>
                      <input
                        type="number"
                        value={formData.max_tokens}
                        onChange={(e) => updateField(type, 'max_tokens', parseInt(e.target.value))}
                        min="1000"
                        max="32000"
                        step="1000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Longitud máxima del documento generado
                      </p>
                    </div>
                  </div>

                  {/* Prompt */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prompt del Transformer
                    </label>
                    <textarea
                      value={formData.prompt}
                      onChange={(e) => updateField(type, 'prompt', e.target.value)}
                      rows={12}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder={`Escribe el prompt para generar ${config.label}...`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Usa <code className="bg-gray-100 px-1 rounded">{'{{sources}}'}</code> donde
                      quieras insertar el contenido de los documentos fuente.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleReset(type)}
                      className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <RotateCcw size={16} />
                      Restaurar por defecto
                    </button>
                    <button
                      onClick={() => handleSave(type)}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      Guardar cambios
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Default prompts for each foundational type
function getDefaultPrompt(type: FoundationalType): string {
  const prompts: Record<FoundationalType, string> = {
    brand_dna: `Analiza los siguientes documentos y extrae toda la información relevante sobre la marca para crear un documento de Brand DNA completo.

## DOCUMENTOS FUENTE
{{sources}}

## INSTRUCCIONES
Estructura tu respuesta en las siguientes secciones:

### Misión
La razón de ser de la marca. ¿Por qué existe?

### Visión
El futuro que la marca quiere crear. ¿A dónde se dirige?

### Valores
Los principios fundamentales que guían las decisiones y acciones de la marca.

### Personalidad de Marca
Los rasgos de personalidad que definen cómo la marca se comunica y se comporta.

### Propuesta de Valor Única
¿Qué hace a esta marca diferente y valiosa para sus clientes?

### Diferenciadores
Los elementos específicos que distinguen a la marca de sus competidores.

### Historia de Origen
El contexto y la historia detrás de la marca.

IMPORTANTE: Solo usa información encontrada en los documentos fuente. No inventes información.`,

    icp: `Analiza los siguientes documentos y extrae toda la información relevante para crear un perfil completo del Cliente Ideal (ICP).

## DOCUMENTOS FUENTE
{{sources}}

## INSTRUCCIONES
Estructura tu respuesta en las siguientes secciones:

### Demografía
- Rango de edad
- Ubicación geográfica
- Nivel socioeconómico
- Ocupación/industria
- Tamaño de empresa (si B2B)

### Psicografía
- Valores y creencias
- Intereses y hobbies
- Estilo de vida
- Actitudes hacia la categoría

### Dolores y Problemas
Los principales desafíos que enfrenta este cliente.

### Motivaciones y Deseos
Lo que busca lograr y por qué.

### Comportamiento de Compra
- Proceso de decisión
- Factores de influencia
- Objeciones comunes
- Canales preferidos

### Jobs to Be Done
Las tareas o trabajos que el cliente intenta resolver.

IMPORTANTE: Solo usa información encontrada en los documentos fuente. No inventes información.`,

    tone_of_voice: `Analiza los siguientes documentos y extrae las directrices de Tono de Voz de la marca.

## DOCUMENTOS FUENTE
{{sources}}

## INSTRUCCIONES
Estructura tu respuesta en las siguientes secciones:

### Personalidad de Voz
Los adjetivos que definen cómo suena la marca (ej: amigable, profesional, innovador).

### Principios de Comunicación
Las reglas fundamentales para toda comunicación de la marca.

### Lo que SÍ hacemos
Comportamientos y estilos permitidos.

### Lo que NO hacemos
Comportamientos y estilos prohibidos.

### Vocabulario Preferido
Palabras y frases que la marca usa frecuentemente.

### Vocabulario a Evitar
Palabras y frases que la marca no debe usar.

### Ejemplos por Canal
Ejemplos de cómo aplicar el tono en diferentes contextos:
- Redes sociales
- Email marketing
- Sitio web
- Atención al cliente

IMPORTANTE: Solo usa información encontrada en los documentos fuente. No inventes información.`,

    product_docs: `Analiza los siguientes documentos y extrae toda la información relevante sobre los productos o servicios.

## DOCUMENTOS FUENTE
{{sources}}

## INSTRUCCIONES
Estructura tu respuesta en las siguientes secciones:

### Catálogo de Productos/Servicios
Lista completa con descripción de cada uno.

### Características Principales
Features y funcionalidades clave.

### Beneficios
Valor que entrega cada producto/servicio al cliente.

### Casos de Uso
Situaciones típicas donde se aplica.

### Especificaciones Técnicas
Detalles técnicos relevantes.

### Preguntas Frecuentes
FAQ basado en información disponible.

IMPORTANTE: Solo usa información encontrada en los documentos fuente. No inventes información.`,

    pricing: `Analiza los siguientes documentos y extrae toda la información relevante sobre precios y estrategia comercial.

## DOCUMENTOS FUENTE
{{sources}}

## INSTRUCCIONES
Estructura tu respuesta en las siguientes secciones:

### Modelo de Precios
Cómo se estructura el pricing (suscripción, por proyecto, etc.)

### Planes/Paquetes
Detalle de cada opción disponible con precios.

### Política de Descuentos
Cuándo y cómo se aplican descuentos.

### Condiciones Comerciales
Términos de pago, garantías, etc.

### Comparativa de Valor
Qué incluye cada nivel de servicio.

### Posicionamiento de Precio
Cómo se compara con el mercado.

IMPORTANTE: Solo usa información encontrada en los documentos fuente. No inventes información.`,

    competitor_analysis: `Analiza los siguientes documentos y extrae toda la información relevante sobre competidores.

## DOCUMENTOS FUENTE
{{sources}}

## INSTRUCCIONES
Estructura tu respuesta en las siguientes secciones:

### Mapa Competitivo
Principales competidores identificados.

### Análisis por Competidor
Para cada competidor:
- Propuesta de valor
- Fortalezas
- Debilidades
- Diferenciadores

### Comparativa de Precios
Cómo se posicionan los precios.

### Gaps de Mercado
Oportunidades no cubiertas.

### Amenazas
Riesgos competitivos identificados.

### Recomendaciones
Cómo diferenciarse efectivamente.

IMPORTANTE: Solo usa información encontrada en los documentos fuente. No inventes información.`,
  }

  return prompts[type] || prompts.brand_dna
}
