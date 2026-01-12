'use client'

import { useState, useRef } from 'react'
import { GripVertical, Trash2, ChevronDown, ChevronUp, Sparkles, UserCheck, GitBranch, Repeat, Copy, Zap } from 'lucide-react'
import type { PlaybookBlock, BlockType, DocumentTier, PlaybookConfig } from '@/types/v2.types'
import { BLOCK_TYPES, TIER_CONFIG } from '@/types/v2.types'
import { AI_MODELS } from '@/types/flow.types'
import { InfoTooltip, TOOLTIPS } from '@/components/ui/InfoTooltip'

interface BlockEditorProps {
  block: PlaybookBlock
  index: number
  availableBlocks: PlaybookBlock[]
  inputSchema: PlaybookConfig['input_schema']
  onChange: (block: PlaybookBlock) => void
  onDelete: () => void
  onDuplicate?: () => void
}

const BlockIcons: Record<BlockType, any> = {
  prompt: Sparkles,
  human_review: UserCheck,
  conditional: GitBranch,
  loop: Repeat,
}

// Model info for better UX
const MODEL_INFO: Record<string, { speed: string; quality: string; cost: string }> = {
  'gemini-2.5-flash': { speed: 'Muy rápido', quality: 'Buena', cost: '$' },
  'gemini-2.5-pro': { speed: 'Medio', quality: 'Excelente', cost: '$$' },
  'gpt-4o': { speed: 'Rápido', quality: 'Excelente', cost: '$$' },
  'gpt-4o-mini': { speed: 'Muy rápido', quality: 'Buena', cost: '$' },
  'o1': { speed: 'Lento', quality: 'Superior', cost: '$$$' },
  'o1-mini': { speed: 'Medio', quality: 'Muy buena', cost: '$$' },
}

// Component to show available variables
function AvailableVariables({
  inputSchema,
  previousBlocks,
  onInsert,
}: {
  inputSchema: PlaybookConfig['input_schema']
  previousBlocks: PlaybookBlock[]
  onInsert: (variable: string) => void
}) {
  const inputKeys = Object.keys(inputSchema || {})
  const hasInputs = inputKeys.length > 0
  const hasPreviousBlocks = previousBlocks.length > 0

  if (!hasInputs && !hasPreviousBlocks) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        <p className="font-medium">No hay variables disponibles aún</p>
        <p className="text-xs mt-1">Agrega campos en la pestaña "Inputs" para usarlos aquí como {`{{nombre_campo}}`}</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
      <div className="font-medium text-slate-700 mb-2 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500" />
        Variables disponibles (click para insertar)
      </div>

      {/* From input schema */}
      {hasInputs && (
        <div className="mb-3">
          <span className="text-xs text-slate-500 uppercase tracking-wide">Inputs del usuario:</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {inputKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onInsert(`{{${key}}}`)}
                className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                title={inputSchema[key]?.description || `Campo: ${key}`}
              >
                {`{{${key}}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* From previous blocks */}
      {hasPreviousBlocks && (
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-wide">Outputs de bloques anteriores:</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {previousBlocks.map((pb) => (
              <button
                key={pb.id}
                type="button"
                onClick={() => onInsert(`{{step:${pb.name}}}`)}
                className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors"
                title={`Resultado del bloque "${pb.name}"`}
              >
                {`{{step:${pb.name}}}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function BlockEditor({
  block,
  index,
  availableBlocks,
  inputSchema,
  onChange,
  onDelete,
  onDuplicate,
}: BlockEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  const Icon = BlockIcons[block.type]
  const blockConfig = BLOCK_TYPES.find((b) => b.value === block.type)

  const handleChange = (updates: Partial<PlaybookBlock>) => {
    onChange({ ...block, ...updates })
  }

  // Insert variable at cursor position in prompt
  const insertVariable = (variable: string) => {
    if (promptRef.current) {
      const textarea = promptRef.current
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const currentPrompt = block.prompt || ''
      const newPrompt = currentPrompt.substring(0, start) + variable + currentPrompt.substring(end)
      handleChange({ prompt: newPrompt })

      // Restore focus and cursor position after React re-render
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length, start + variable.length)
      }, 0)
    } else {
      // Fallback: append to end
      handleChange({ prompt: (block.prompt || '') + variable })
    }
  }

  // Previous blocks for "receives_from"
  const previousBlocks = availableBlocks.filter(
    (b) => b.order < block.order && b.id !== block.id
  )

  // Get current model info
  const currentModel = block.model || 'gemini-2.5-flash'
  const modelInfo = MODEL_INFO[currentModel]

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />

        <div className="p-1.5 bg-white rounded-lg border border-gray-200 shadow-sm">
          <Icon className="w-4 h-4 text-indigo-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">#{index + 1}</span>
            <input
              type="text"
              value={block.name}
              onChange={(e) => handleChange({ name: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-gray-900 bg-transparent border-none focus:ring-0 p-0 flex-1"
              placeholder="Nombre del bloque"
            />
          </div>
          <p className="text-xs text-gray-500">{blockConfig?.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={block.type}
            onChange={(e) => handleChange({ type: e.target.value as BlockType })}
            onClick={(e) => e.stopPropagation()}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
          >
            {BLOCK_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          {onDuplicate && (
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate() }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Duplicar bloque"
            >
              <Copy size={14} />
            </button>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar bloque"
          >
            <Trash2 size={14} />
          </button>

          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-gray-100">
          {/* Prompt block */}
          {block.type === 'prompt' && (
            <>
              {/* Available Variables */}
              <AvailableVariables
                inputSchema={inputSchema}
                previousBlocks={previousBlocks}
                onInsert={insertVariable}
              />

              {/* Prompt text */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                  Prompt
                </label>
                <textarea
                  ref={promptRef}
                  value={block.prompt || ''}
                  onChange={(e) => handleChange({ prompt: e.target.value })}
                  placeholder="Escribe el prompt... Usa las variables de arriba haciendo click o escribe manualmente {{variable}}"
                  rows={6}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>

              {/* Model selection with info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                    Modelo
                    <InfoTooltip position="right">
                      <div className="space-y-2">
                        <p className="font-medium">Modelos de IA disponibles</p>
                        <ul className="space-y-1 text-slate-300">
                          <li><strong>Gemini Flash:</strong> Rápido y económico</li>
                          <li><strong>Gemini Pro:</strong> Alta calidad</li>
                          <li><strong>GPT-4o:</strong> Multimodal, rápido</li>
                          <li><strong>o1:</strong> Razonamiento avanzado</li>
                        </ul>
                      </div>
                    </InfoTooltip>
                  </label>
                  <select
                    value={`${block.provider || 'gemini'}:${block.model || 'gemini-2.5-flash'}`}
                    onChange={(e) => {
                      const [provider, model] = e.target.value.split(':')
                      handleChange({ provider, model })
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    {AI_MODELS.map((m) => (
                      <option key={`${m.provider}:${m.model}`} value={`${m.provider}:${m.model}`}>
                        {m.label} ({m.provider})
                      </option>
                    ))}
                  </select>
                  {modelInfo && (
                    <div className="flex gap-2 mt-1.5 text-xs">
                      <span className="text-gray-500">⚡ {modelInfo.speed}</span>
                      <span className="text-gray-500">✨ {modelInfo.quality}</span>
                      <span className="text-gray-500">{modelInfo.cost}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                    Formato Output
                    <InfoTooltip>{TOOLTIPS.outputFormat}</InfoTooltip>
                  </label>
                  <select
                    value={block.output_format || 'markdown'}
                    onChange={(e) => handleChange({ output_format: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="markdown">Markdown</option>
                    <option value="text">Texto plano</option>
                    <option value="json">JSON</option>
                    <option value="html">HTML</option>
                  </select>
                </div>
              </div>

              {/* Temperature and tokens */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                    Temperatura: {block.temperature || 0.7}
                    <InfoTooltip>{TOOLTIPS.temperature}</InfoTooltip>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={block.temperature || 0.7}
                    onChange={(e) => handleChange({ temperature: parseFloat(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Preciso</span>
                    <span>Creativo</span>
                  </div>
                </div>

                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                    Max Tokens
                    <InfoTooltip>{TOOLTIPS.maxTokens}</InfoTooltip>
                  </label>
                  <input
                    type="number"
                    value={block.max_tokens || 4096}
                    onChange={(e) => handleChange({ max_tokens: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Context tiers */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                  Tiers de Contexto
                  <InfoTooltip position="right" width="w-80">{TOOLTIPS.contextTiers}</InfoTooltip>
                </label>
                <div className="flex gap-2">
                  {([1, 2, 3] as DocumentTier[]).map((tier) => {
                    const isSelected = block.context_tiers?.includes(tier)
                    const config = TIER_CONFIG[tier]
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => {
                          const current = block.context_tiers || []
                          const updated = isSelected
                            ? current.filter((t) => t !== tier)
                            : [...current, tier]
                          handleChange({ context_tiers: updated })
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          isSelected
                            ? `${config.bgClass} ${config.textClass} ${config.borderClass} border`
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {config.name}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  Los documentos de estos tiers se incluirán como contexto para el prompt
                </p>
              </div>

              {/* Receives from */}
              {previousBlocks.length > 0 && (
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                    Recibe output de
                    <InfoTooltip>{TOOLTIPS.receivesFrom}</InfoTooltip>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {previousBlocks.map((pb) => {
                      const isSelected = block.receives_from?.includes(pb.id)
                      return (
                        <button
                          key={pb.id}
                          type="button"
                          onClick={() => {
                            const current = block.receives_from || []
                            const updated = isSelected
                              ? current.filter((id) => id !== pb.id)
                              : [...current, pb.id]
                            handleChange({ receives_from: updated })
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {pb.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Human review block */}
          {block.type === 'human_review' && (
            <>
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                  Tipo de Interfaz
                  <InfoTooltip>{TOOLTIPS.hitlInterface}</InfoTooltip>
                </label>
                <select
                  value={block.hitl_config?.interface_type || 'approve_reject'}
                  onChange={(e) => handleChange({
                    hitl_config: {
                      ...block.hitl_config,
                      enabled: true,
                      interface_type: e.target.value as any,
                    },
                  })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="approve_reject">Aprobar / Rechazar</option>
                  <option value="edit">Editar output</option>
                  <option value="select_option">Seleccionar opción</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Prompt para el revisor
                </label>
                <textarea
                  value={block.hitl_config?.prompt || ''}
                  onChange={(e) => handleChange({
                    hitl_config: {
                      ...block.hitl_config,
                      enabled: true,
                      interface_type: block.hitl_config?.interface_type || 'approve_reject',
                      prompt: e.target.value,
                    },
                  })}
                  placeholder="Ej: Revisa el análisis de mercado y aprueba si es correcto..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Timeout (horas)
                </label>
                <input
                  type="number"
                  value={block.hitl_config?.timeout_hours || 24}
                  onChange={(e) => handleChange({
                    hitl_config: {
                      ...block.hitl_config,
                      enabled: true,
                      interface_type: block.hitl_config?.interface_type || 'approve_reject',
                      timeout_hours: parseInt(e.target.value),
                    },
                  })}
                  className="w-32 px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Si no hay respuesta, la ejecución continuará automáticamente
                </p>
              </div>
            </>
          )}

          {/* Conditional block */}
          {block.type === 'conditional' && (
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                Condición (expresión JS)
                <InfoTooltip position="right" width="w-72">{TOOLTIPS.condition}</InfoTooltip>
              </label>
              <textarea
                value={block.condition || ''}
                onChange={(e) => handleChange({ condition: e.target.value })}
                placeholder="Ejemplo: outputs.step1.includes('aprobado')"
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
          )}

          {/* Loop block */}
          {block.type === 'loop' && (
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                Fuente de items (expresión)
                <InfoTooltip>{TOOLTIPS.loopItems}</InfoTooltip>
              </label>
              <input
                type="text"
                value={block.items_source || ''}
                onChange={(e) => handleChange({ items_source: e.target.value })}
                placeholder="Ejemplo: inputs.products o outputs.step1.split('\\n')"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
