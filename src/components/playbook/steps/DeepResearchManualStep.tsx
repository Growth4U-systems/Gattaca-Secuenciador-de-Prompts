'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, ExternalLink, FileText, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { StepDefinition, StepState } from '../types'

interface DeepResearchManualStepProps {
  step: StepDefinition
  stepState: StepState
  onContinue: () => void
  onUpdateState: (update: Partial<StepState>) => void
  previousStepOutput?: string // La tabla de nichos del paso anterior
  projectId: string
}

// El prompt de Deep Research del template
const DEEP_RESEARCH_PROMPT = `Rol: Eres un analista de estrategia de mercado de élite, con especialización en go to market en la industria {{industry}} y tienes un conocimiento granular del mercado de {{country}}. Tu metodología combina el análisis de datos riguroso con una profunda comprensión de la psicología del consumidor.

Objetivo: Realizar una investigación exhaustiva y multidimensional de cada nicho de mercado presentado. El objetivo final es generar un informe de viabilidad individual e independiente para cada nicho.

Regla Mandatoria: El análisis debe ser estrictamente individual. Está terminantemente prohibido agrupar, resumir o comparar nichos. Cada nicho debe ser tratado como un informe de viabilidad completamente autónomo.

Input de Datos:
Columna a filtrar: "Valid" (analiza solamente los nichos donde sea igual a "TRUE")
Columna a Analizar: "Niche (Consolidated)"

PARA CADA NICHO, GENERA EL SIGUIENTE ANÁLISIS:

## [Nombre del Nicho]

### 1. Intensidad del Dolor (Pain Score)
**Calificación: [2-99] / 100**

Evaluación basada en Jobs to be Done (Push, Pull, Habit, Anxiety):
- **Push (El Problema):**
  - Utility Job: ¿Cuál es la gravedad funcional?
  - Emotional Job: ¿Cuál es la gravedad emocional?
- **Product Fit (La Solución):**
  - Pull y Anxiety

Variables Cuantitativas:
- Pérdida Económica Directa (€/año)
- Coste de Oportunidad
- Pérdida de Tiempo (horas/mes)

Variables Cualitativas:
- Carga Cognitiva y Estrés
- Fricción y Complejidad
- Obstáculos a Objetivos Vitales
- Impacto Social o Profesional
- Frecuencia e Inevitabilidad

### 2. Tamaño del Mercado (Market Size)
**SAM Estimado: [número] personas en {{country}}**

- Nivel de Confianza: [Alto/Medio/Bajo]
- Método: Top-Down + Bottom-Up
- Fuentes: INE, Eurostat, Seguridad Social, Statista, etc.
- Tendencia: [Crecimiento Acelerado/Moderado/Estable/Decrecimiento]
- Competencia: ¿Quién está resolviendo esto ahora?

### 3. Reachability Score
**Calificación: [2-99] / 100**

Criterios:
- Comunidades Online (foros, grupos, plataformas específicas)
- Comunidades Físicas (eventos, lugares)
- Creadores de Contenido (influencers del nicho)
- Contenido y Palabras Clave
- Complejidad del Producto
- Competencia (afecta CACs)

Canales específicos:
- Subreddits/grupos exactos con nombre
- Influencers específicos con handle
- Táctica de ads detallada
- Partnerships estratégicos

---
Para cada nicho incluir:
- Pain Score (2-99)
- Reachability Score (2-99)
- Market Size (número de personas)
- Pain Explanation
- Reachability Explanation
- Market Size Explanation`

export default function DeepResearchManualStep({
  step,
  stepState,
  onContinue,
  onUpdateState,
  previousStepOutput,
  projectId,
}: DeepResearchManualStepProps) {
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [copiedTable, setCopiedTable] = useState(false)
  const [researchResults, setResearchResults] = useState(stepState.input || '')
  const [showPrompt, setShowPrompt] = useState(false)
  const [showTable, setShowTable] = useState(true)

  // Cargar resultados guardados si existen
  useEffect(() => {
    if (stepState.input) {
      setResearchResults(stepState.input)
    }
  }, [stepState.input])

  const copyToClipboard = async (text: string, type: 'prompt' | 'table') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'prompt') {
        setCopiedPrompt(true)
        setTimeout(() => setCopiedPrompt(false), 2000)
      } else {
        setCopiedTable(true)
        setTimeout(() => setCopiedTable(false), 2000)
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error)
    }
  }

  const handleSaveResults = () => {
    onUpdateState({
      input: researchResults,
      status: 'completed',
      completedAt: new Date(),
    })
    onContinue()
  }

  const canContinue = researchResults.trim().length > 100 // Mínimo 100 caracteres

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="text-purple-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">{step.name}</h3>
        </div>
        <p className="text-sm text-gray-600">{step.description}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">Instrucciones para el Deep Research:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Copia la <strong>tabla de nichos</strong> del paso anterior</li>
                <li>Copia el <strong>prompt de Deep Research</strong></li>
                <li>Ve a <strong>ChatGPT o Perplexity</strong> y pega ambos</li>
                <li>Ejecuta el análisis para cada nicho válido</li>
                <li>Copia los resultados y pégalos aquí abajo</li>
              </ol>
            </div>
          </div>
        </div>

        {/* External Links */}
        <div className="flex gap-3">
          <a
            href="https://chat.openai.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            <ExternalLink size={16} />
            Abrir ChatGPT
          </a>
          <a
            href="https://www.perplexity.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            <ExternalLink size={16} />
            Abrir Perplexity
          </a>
        </div>

        {/* Niche Table from previous step */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowTable(!showTable)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              {showTable ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              <span className="font-medium text-gray-900">1. Tabla de Nichos (del paso anterior)</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                copyToClipboard(previousStepOutput || '(Sin datos del paso anterior)', 'table')
              }}
              className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
            >
              {copiedTable ? <Check size={14} /> : <Copy size={14} />}
              {copiedTable ? 'Copiado!' : 'Copiar'}
            </button>
          </button>

          {showTable && (
            <div className="p-4 bg-white max-h-64 overflow-y-auto">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {previousStepOutput || '(Sin datos del paso anterior - ejecuta el paso de Limpiar y Filtrar primero)'}
              </pre>
            </div>
          )}
        </div>

        {/* Deep Research Prompt */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              {showPrompt ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              <span className="font-medium text-gray-900">2. Prompt de Deep Research</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                copyToClipboard(DEEP_RESEARCH_PROMPT, 'prompt')
              }}
              className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
            >
              {copiedPrompt ? <Check size={14} /> : <Copy size={14} />}
              {copiedPrompt ? 'Copiado!' : 'Copiar'}
            </button>
          </button>

          {showPrompt && (
            <div className="p-4 bg-white max-h-64 overflow-y-auto">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {DEEP_RESEARCH_PROMPT}
              </pre>
            </div>
          )}
        </div>

        {/* Results Input */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <span className="font-medium text-gray-900">3. Pega los resultados del Deep Research</span>
            <p className="text-xs text-gray-500 mt-1">
              Pega aquí los resultados completos de ChatGPT/Perplexity con los análisis de cada nicho
            </p>
          </div>
          <div className="p-4">
            <textarea
              value={researchResults}
              onChange={(e) => setResearchResults(e.target.value)}
              placeholder="Pega aquí los resultados del Deep Research...

## Nicho 1: [Nombre]
### 1. Intensidad del Dolor (Pain Score)
**Calificación: XX / 100**
...

## Nicho 2: [Nombre]
..."
              rows={12}
              className="w-full p-3 !bg-white !text-gray-900 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">
                {researchResults.length} caracteres
                {researchResults.length < 100 && ' (mínimo 100 para continuar)'}
              </span>
              {researchResults.length > 0 && (
                <button
                  onClick={() => setResearchResults('')}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            El siguiente paso consolidará estos resultados con la tabla de nichos
          </span>
          <button
            onClick={handleSaveResults}
            disabled={!canContinue}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={16} />
            Guardar y Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
