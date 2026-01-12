'use client'

import { useState, useEffect } from 'react'
import { X, Save, Plus, AlertCircle, Workflow, Tag, ArrowRight, GitBranch, User, RotateCcw, Sparkles, Video, Search, Target } from 'lucide-react'
import type { Playbook, PlaybookInsert, PlaybookConfig, PlaybookBlock, PlaybookType, InputField } from '@/types/v2.types'
import { createEmptyBlock, createEmptyPlaybookConfig, validatePlaybookConfig } from '@/hooks/usePlaybooks'
import BlockEditor from './BlockEditor'
import { PLAYBOOK_TEMPLATES, type PlaybookTemplateId } from '@/data/example-playbooks'

// Template selector component
function TemplateSelector({ onSelect }: { onSelect: (templateId: PlaybookTemplateId) => void }) {
  const getTemplateIcon = (category: string) => {
    switch (category) {
      case 'video': return <Video className="w-5 h-5" />
      case 'strategy': return <Target className="w-5 h-5" />
      case 'research': return <Search className="w-5 h-5" />
      default: return <Sparkles className="w-5 h-5" />
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Sparkles size={16} className="text-purple-500" />
        <span>O empieza desde un template:</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(PLAYBOOK_TEMPLATES).map(([id, template]) => (
          <button
            key={id}
            onClick={() => onSelect(id as PlaybookTemplateId)}
            className="p-3 border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-all text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg text-purple-600 group-hover:bg-purple-200">
                {getTemplateIcon(template.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">
                  {template.name}
                </div>
                <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                  {template.description}
                </div>
                <div className="flex gap-1 mt-2">
                  {template.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Visual flow preview component
function FlowPreview({ blocks, inputSchema }: { blocks: PlaybookBlock[]; inputSchema: PlaybookConfig['input_schema'] }) {
  if (blocks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Workflow className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Agrega bloques para ver el flujo</p>
      </div>
    )
  }

  const getBlockIcon = (type: PlaybookBlock['type']) => {
    switch (type) {
      case 'prompt': return '🤖'
      case 'conditional': return '🔀'
      case 'human_review': return '👤'
      case 'loop': return '🔄'
      default: return '📦'
    }
  }

  const getBlockColor = (type: PlaybookBlock['type']) => {
    switch (type) {
      case 'prompt': return 'bg-blue-100 border-blue-300 text-blue-800'
      case 'conditional': return 'bg-amber-100 border-amber-300 text-amber-800'
      case 'human_review': return 'bg-purple-100 border-purple-300 text-purple-800'
      case 'loop': return 'bg-green-100 border-green-300 text-green-800'
      default: return 'bg-gray-100 border-gray-300 text-gray-800'
    }
  }

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white p-4 rounded-xl border border-slate-200">
      <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
        <Workflow size={14} />
        <span>Flujo de ejecución</span>
      </div>

      {/* Start node */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
          ▶
        </div>
        <div className="text-xs text-slate-600">
          <span className="font-medium">Inicio</span>
          {Object.keys(inputSchema).length > 0 && (
            <span className="text-slate-400 ml-1">
              ({Object.keys(inputSchema).length} inputs)
            </span>
          )}
        </div>
      </div>

      {/* Blocks */}
      <div className="ml-4 border-l-2 border-slate-200 pl-4 space-y-2">
        {blocks.map((block, index) => (
          <div key={block.id} className="relative">
            {/* Connection arrow */}
            <div className="absolute -left-[22px] top-3 w-4 h-0.5 bg-slate-200" />

            <div className={`flex items-center gap-2 p-2 rounded-lg border ${getBlockColor(block.type)}`}>
              <span className="text-base">{getBlockIcon(block.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{block.name}</div>
                {block.receives_from && block.receives_from.length > 0 && (
                  <div className="text-[10px] opacity-70 flex items-center gap-1">
                    <ArrowRight size={10} />
                    <span>desde: {block.receives_from.join(', ')}</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] bg-white/50 px-1.5 py-0.5 rounded">
                #{index + 1}
              </span>
            </div>

            {/* HITL indicator */}
            {block.hitl_config?.enabled && (
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                <User size={10} className="text-white" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* End node */}
      <div className="flex items-center gap-2 mt-3 ml-4 pl-4">
        <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
          ■
        </div>
        <div className="text-xs text-slate-600 font-medium">Fin</div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-200">
        <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">🤖 Prompt IA</span>
          <span className="flex items-center gap-1">🔀 Condicional</span>
          <span className="flex items-center gap-1">👤 Revisión</span>
          <span className="flex items-center gap-1">🔄 Loop</span>
        </div>
      </div>
    </div>
  )
}

interface PlaybookEditorProps {
  playbook?: Playbook | null
  agencyId: string
  isOpen: boolean
  onClose: () => void
  onSave: (data: PlaybookInsert) => Promise<void>
}

export default function PlaybookEditor({
  playbook,
  agencyId,
  isOpen,
  onClose,
  onSave,
}: PlaybookEditorProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<PlaybookType>('playbook')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [config, setConfig] = useState<PlaybookConfig>(createEmptyPlaybookConfig())
  const [activeTab, setActiveTab] = useState<'basic' | 'inputs' | 'blocks' | 'output'>('basic')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  // Reset form when playbook changes
  useEffect(() => {
    if (playbook) {
      setName(playbook.name)
      setDescription(playbook.description || '')
      setType(playbook.type)
      setTags(playbook.tags)
      setConfig(playbook.config)
    } else {
      setName('')
      setDescription('')
      setType('playbook')
      setTags([])
      setConfig(createEmptyPlaybookConfig())
    }
    setErrors([])
    setActiveTab('basic')
  }, [playbook, isOpen])

  const handleAddTag = () => {
    const tag = tagInput.trim().toUpperCase()
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleAddBlock = () => {
    const newBlock = createEmptyBlock(config.blocks.length)
    setConfig({
      ...config,
      blocks: [...config.blocks, newBlock],
    })
  }

  const handleUpdateBlock = (index: number, block: PlaybookBlock) => {
    const blocks = [...config.blocks]
    blocks[index] = block
    setConfig({ ...config, blocks })
  }

  const handleDeleteBlock = (index: number) => {
    const blocks = config.blocks.filter((_, i) => i !== index)
    // Re-order remaining blocks
    blocks.forEach((b, i) => { b.order = i })
    setConfig({ ...config, blocks })
  }

  const handleAddInput = () => {
    const fieldName = `field_${Object.keys(config.input_schema).length + 1}`
    setConfig({
      ...config,
      input_schema: {
        ...config.input_schema,
        [fieldName]: {
          type: 'string',
          required: true,
          label: 'Nuevo campo',
        },
      },
    })
  }

  const handleUpdateInput = (oldKey: string, newKey: string, field: InputField) => {
    const schema = { ...config.input_schema }
    if (oldKey !== newKey) {
      delete schema[oldKey]
    }
    schema[newKey] = field
    setConfig({ ...config, input_schema: schema })
  }

  const handleDeleteInput = (key: string) => {
    const schema = { ...config.input_schema }
    delete schema[key]
    setConfig({ ...config, input_schema: schema })
  }

  const handleLoadTemplate = (templateId: PlaybookTemplateId) => {
    const template = PLAYBOOK_TEMPLATES[templateId]
    setName(template.name)
    setDescription(template.description)
    setTags(template.tags as unknown as string[])
    setConfig(template.config)
    setActiveTab('blocks') // Jump to blocks to show the loaded content
  }

  const handleSave = async () => {
    // Validate
    const validation = validatePlaybookConfig(config)
    if (!validation.valid) {
      setErrors(validation.errors)
      setActiveTab('blocks')
      return
    }

    if (!name.trim()) {
      setErrors(['El nombre es requerido'])
      setActiveTab('basic')
      return
    }

    setSaving(true)
    setErrors([])

    try {
      await onSave({
        agency_id: agencyId,
        name: name.trim(),
        description: description.trim() || null,
        type,
        tags,
        config,
        version: playbook?.version || '1.0.0',
        status: playbook?.status || 'draft',
        schedule_enabled: false,
        schedule_cron: null,
        schedule_timezone: 'UTC',
        author_id: null,
      })
      onClose()
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Error al guardar'])
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Workflow className="w-6 h-6 text-white" />
            <h2 className="text-lg font-semibold text-white">
              {playbook ? 'Editar Playbook' : 'Nuevo Playbook'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {[
            { id: 'basic', label: 'Básico' },
            { id: 'inputs', label: 'Inputs' },
            { id: 'blocks', label: 'Bloques' },
            { id: 'output', label: 'Output' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.id === 'blocks' && config.blocks.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                  {config.blocks.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              {errors.map((error, i) => (
                <p key={i} className="text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle size={14} />
                  {error}
                </p>
              ))}
            </div>
          )}

          {/* Basic Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-5">
              {/* Template Selector - only for new playbooks */}
              {!playbook && config.blocks.length === 0 && (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <TemplateSelector onSelect={handleLoadTemplate} />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del playbook"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe qué hace este playbook..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as PlaybookType)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="playbook">Playbook - Genera assets</option>
                  <option value="enricher">Enricher - Alimenta Context Lake</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-sm"
                    >
                      <Tag size={12} />
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-indigo-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Agregar tag..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Inputs Tab */}
          {activeTab === 'inputs' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Define los campos que el usuario debe completar al ejecutar el playbook.
              </p>

              {Object.entries(config.input_schema).map(([key, field]) => (
                <div key={key} className="p-4 border border-gray-200 rounded-xl space-y-3">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => handleUpdateInput(key, e.target.value, field)}
                      placeholder="nombre_campo"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => handleUpdateInput(key, key, { ...field, type: e.target.value as any })}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="string">Texto</option>
                      <option value="textarea">Texto largo</option>
                      <option value="number">Número</option>
                      <option value="boolean">Sí/No</option>
                      <option value="select">Selección</option>
                    </select>
                    <button
                      onClick={() => handleDeleteInput(key)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={field.label || ''}
                      onChange={(e) => handleUpdateInput(key, key, { ...field, label: e.target.value })}
                      placeholder="Label"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => handleUpdateInput(key, key, { ...field, required: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">Requerido</span>
                    </label>
                  </div>
                </div>
              ))}

              <button
                onClick={handleAddInput}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Agregar campo
              </button>
            </div>
          )}

          {/* Blocks Tab */}
          {activeTab === 'blocks' && (
            <div className="space-y-4">
              {/* Flow Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <p className="text-sm text-gray-600 mb-4">
                    Configura los bloques que componen el playbook. El orden determina la secuencia de ejecución.
                  </p>
                </div>
                <div className="lg:col-span-1">
                  <FlowPreview blocks={config.blocks} inputSchema={config.input_schema} />
                </div>
              </div>

              {config.blocks.map((block, index) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  index={index}
                  availableBlocks={config.blocks}
                  inputSchema={config.input_schema}
                  onChange={(updated) => handleUpdateBlock(index, updated)}
                  onDelete={() => handleDeleteBlock(index)}
                  onDuplicate={() => {
                    const newBlock = {
                      ...block,
                      id: `block-${Date.now()}`,
                      name: `${block.name} (copia)`,
                      order: config.blocks.length,
                    }
                    setConfig({
                      ...config,
                      blocks: [...config.blocks, newBlock],
                    })
                  }}
                />
              ))}

              <button
                onClick={handleAddBlock}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Agregar bloque
              </button>
            </div>
          )}

          {/* Output Tab */}
          {activeTab === 'output' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Destino</label>
                <select
                  value={config.output_config.destination}
                  onChange={(e) => setConfig({
                    ...config,
                    output_config: { ...config.output_config, destination: e.target.value as any },
                  })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="context_lake">Context Lake (como documento)</option>
                  <option value="asset_library">Asset Library</option>
                  <option value="export">Exportar (descargar)</option>
                </select>
              </div>

              {config.output_config.destination === 'context_lake' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Tier del documento generado
                    </label>
                    <select
                      value={config.output_config.document_tier || 3}
                      onChange={(e) => setConfig({
                        ...config,
                        output_config: { ...config.output_config, document_tier: parseInt(e.target.value) as any },
                      })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={1}>Tier 1 - La Verdad</option>
                      <option value={2}>Tier 2 - Operativo</option>
                      <option value={3}>Tier 3 - Efímero</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Tipo de documento
                    </label>
                    <input
                      type="text"
                      value={config.output_config.document_type || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        output_config: { ...config.output_config, document_type: e.target.value },
                      })}
                      placeholder="output"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {config.output_config.destination === 'asset_library' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tipo de asset
                  </label>
                  <input
                    type="text"
                    value={config.output_config.asset_type || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      output_config: { ...config.output_config, asset_type: e.target.value },
                    })}
                    placeholder="strategy_doc"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar Playbook'}
          </button>
        </div>
      </div>
    </div>
  )
}
