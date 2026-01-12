'use client'

import { Info } from 'lucide-react'
import { ReactNode } from 'react'

interface InfoTooltipProps {
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  width?: string
}

export function InfoTooltip({
  children,
  position = 'top',
  width = 'w-64'
}: InfoTooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800 border-y-transparent border-l-transparent',
  }

  return (
    <div className="group relative inline-flex items-center ml-1">
      <Info className="h-4 w-4 text-slate-400 cursor-help hover:text-slate-600 transition-colors" />
      <div
        className={`
          hidden group-hover:block absolute z-50 ${width} p-3
          bg-slate-800 text-white text-xs rounded-lg shadow-xl
          ${positionClasses[position]}
          animate-in fade-in-0 zoom-in-95 duration-200
        `}
      >
        {children}
        <div
          className={`
            absolute w-0 h-0 border-4
            ${arrowClasses[position]}
          `}
        />
      </div>
    </div>
  )
}

// Preset tooltips for common fields
export const TOOLTIPS = {
  temperature: (
    <div className="space-y-2">
      <p className="font-medium">Temperatura del modelo</p>
      <p>Controla qué tan creativas o predecibles son las respuestas:</p>
      <ul className="list-disc list-inside space-y-1 text-slate-300">
        <li><strong>0.0-0.3:</strong> Muy consistente, ideal para datos/análisis</li>
        <li><strong>0.4-0.7:</strong> Balance entre creatividad y coherencia</li>
        <li><strong>0.8-1.0:</strong> Creativo, bueno para contenido</li>
        <li><strong>1.0-2.0:</strong> Muy creativo, puede ser impredecible</li>
      </ul>
    </div>
  ),

  maxTokens: (
    <div className="space-y-2">
      <p className="font-medium">Tokens máximos de salida</p>
      <p>Limita la longitud de la respuesta:</p>
      <ul className="list-disc list-inside space-y-1 text-slate-300">
        <li><strong>500-1000:</strong> Respuestas cortas</li>
        <li><strong>1000-2000:</strong> Respuestas medianas</li>
        <li><strong>2000-4000:</strong> Respuestas largas/detalladas</li>
        <li><strong>4000+:</strong> Documentos extensos</li>
      </ul>
      <p className="text-slate-400 text-[10px] mt-1">1 token ≈ 4 caracteres en español</p>
    </div>
  ),

  contextTiers: (
    <div className="space-y-2">
      <p className="font-medium">Tiers de Context Lake</p>
      <p>Selecciona qué documentos incluir como contexto:</p>
      <ul className="space-y-2 text-slate-300">
        <li>
          <strong className="text-amber-400">Tier 1 - La Verdad:</strong>
          <br />Brand DNA, ICP, Tone of Voice, Product Docs
        </li>
        <li>
          <strong className="text-blue-400">Tier 2 - Operativo:</strong>
          <br />Campaign briefs, Competitor analysis, Market research
        </li>
        <li>
          <strong className="text-slate-400">Tier 3 - Efímero:</strong>
          <br />Outputs generados, Referencias temporales
        </li>
      </ul>
    </div>
  ),

  outputFormat: (
    <div className="space-y-2">
      <p className="font-medium">Formato de salida</p>
      <p>Define cómo se estructura la respuesta:</p>
      <ul className="list-disc list-inside space-y-1 text-slate-300">
        <li><strong>Markdown:</strong> Títulos, listas, énfasis</li>
        <li><strong>Text:</strong> Texto plano sin formato</li>
        <li><strong>JSON:</strong> Datos estructurados</li>
        <li><strong>HTML:</strong> Contenido web</li>
      </ul>
    </div>
  ),

  receivesFrom: (
    <div className="space-y-2">
      <p className="font-medium">Recibe output de</p>
      <p>Incluye automáticamente el resultado de bloques anteriores en el prompt.</p>
      <p className="text-slate-300">Útil para encadenar análisis donde cada paso construye sobre el anterior.</p>
    </div>
  ),

  hitlInterface: (
    <div className="space-y-2">
      <p className="font-medium">Tipo de revisión humana</p>
      <ul className="list-disc list-inside space-y-1 text-slate-300">
        <li><strong>Aprobar/Rechazar:</strong> Simple confirmación</li>
        <li><strong>Editar:</strong> Permite modificar el output</li>
        <li><strong>Seleccionar:</strong> Elegir entre opciones</li>
      </ul>
    </div>
  ),

  condition: (
    <div className="space-y-2">
      <p className="font-medium">Expresión condicional</p>
      <p>Escribe una expresión JavaScript que evalúe a true/false.</p>
      <p className="text-slate-300">Variables disponibles:</p>
      <ul className="list-disc list-inside text-slate-300">
        <li><code className="bg-slate-700 px-1 rounded">inputs</code> - datos de entrada</li>
        <li><code className="bg-slate-700 px-1 rounded">outputs</code> - resultados previos</li>
        <li><code className="bg-slate-700 px-1 rounded">context</code> - documentos</li>
      </ul>
      <p className="text-slate-400 text-[10px] mt-1">Ej: inputs.budget {'>'} 10000</p>
    </div>
  ),

  loopItems: (
    <div className="space-y-2">
      <p className="font-medium">Fuente de items</p>
      <p>Expresión que retorna un array para iterar.</p>
      <p className="text-slate-400 text-[10px]">Ej: inputs.products o outputs.research.items</p>
    </div>
  ),
}
