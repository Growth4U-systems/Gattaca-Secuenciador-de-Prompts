/**
 * N8n Import Panel
 *
 * UI component for importing n8n workflows and converting them to Gattaca playbooks.
 */

'use client'

import { useState, useCallback } from 'react'
import { Upload, FileJson, AlertCircle, CheckCircle, Loader2, Download, X, ChevronDown, ChevronRight } from 'lucide-react'

// ============================================
// Types
// ============================================

interface ConversionResult {
  success: boolean
  playbookId?: string
  workflowName?: string
  stats: {
    totalNodes: number
    convertedNodes: number
    partialNodes: number
    unsupportedNodes: number
    phasesGenerated: number
    stepsGenerated: number
    apiRoutesGenerated: number
    conversionTimeMs: number
  }
  warnings: Array<{
    severity: 'info' | 'warning' | 'error'
    message: string
    nodeId?: string
    suggestion?: string
  }>
  envVariables: Array<{
    name: string
    description: string
    required: boolean
  }>
  manualSteps: string[]
  generatedFiles: Array<{
    path: string
    type: string
    description: string
  }>
}

interface ImportState {
  status: 'idle' | 'uploading' | 'parsing' | 'converting' | 'complete' | 'error'
  progress: number
  message: string
  result?: ConversionResult
  error?: string
}

type TabKey = 'files' | 'warnings' | 'env' | 'manual'

// ============================================
// Component
// ============================================

export function N8nImportPanel() {
  const [state, setState] = useState<ImportState>({
    status: 'idle',
    progress: 0,
    message: '',
  })
  const [playbookId, setPlaybookId] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('files')

  // Handle file drop
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragActive(false)

      const file = e.dataTransfer.files[0]
      if (file && file.name.endsWith('.json')) {
        await processFile(file)
      } else {
        setState({
          status: 'error',
          progress: 0,
          message: '',
          error: 'Please upload a JSON file exported from n8n',
        })
      }
    },
    [playbookId]
  )

  // Handle file input
  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        await processFile(file)
      }
    },
    [playbookId]
  )

  // Process uploaded file
  const processFile = async (file: File) => {
    setState({
      status: 'uploading',
      progress: 10,
      message: 'Reading file...',
    })

    try {
      // Read file content
      const content = await file.text()

      setState({
        status: 'parsing',
        progress: 30,
        message: 'Parsing workflow...',
      })

      // Validate JSON
      let workflow
      try {
        workflow = JSON.parse(content)
      } catch {
        throw new Error('Invalid JSON file')
      }

      // Check it looks like an n8n workflow
      if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
        throw new Error('This does not appear to be a valid n8n workflow export')
      }

      setState({
        status: 'converting',
        progress: 50,
        message: `Converting ${workflow.nodes.length} nodes...`,
      })

      // Call conversion API
      const response = await fetch('/api/n8n-converter/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: content,
          playbookId: playbookId || generatePlaybookId(workflow.name),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Conversion failed')
      }

      const result: ConversionResult = await response.json()

      setState({
        status: 'complete',
        progress: 100,
        message: 'Conversion complete!',
        result,
      })
    } catch (error) {
      setState({
        status: 'error',
        progress: 0,
        message: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  // Generate playbook ID from workflow name
  const generatePlaybookId = (name?: string): string => {
    if (!name) return `playbook-${Date.now()}`
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50)
  }

  // Reset state
  const handleReset = () => {
    setState({ status: 'idle', progress: 0, message: '' })
    setPlaybookId('')
  }

  // Download generated files
  const handleDownload = async () => {
    if (!state.result?.playbookId) return

    try {
      const response = await fetch(
        `/api/n8n-converter/download?playbookId=${state.result.playbookId}`
      )
      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${state.result.playbookId}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Import n8n Workflow
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Convert your n8n workflows to Gattaca playbooks
        </p>
      </div>

      {/* Upload Area */}
      {state.status === 'idle' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <FileJson className="h-5 w-5" />
              Upload Workflow
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Export your workflow from n8n (Workflow → Export) and upload the JSON file here
            </p>
          </div>
          <div className="p-6 space-y-4">
            {/* Playbook ID Input */}
            <div className="space-y-2">
              <label htmlFor="playbookId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Playbook ID (optional)
              </label>
              <input
                id="playbookId"
                type="text"
                placeholder="my-workflow (auto-generated if empty)"
                value={playbookId}
                onChange={(e) => setPlaybookId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Drop Zone */}
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${dragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}
              `}
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Drop n8n workflow JSON here
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                or click to browse
              </p>
              <input
                id="file-input"
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      {['uploading', 'parsing', 'converting'].includes(state.status) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <span className="font-medium text-gray-900 dark:text-gray-100">{state.message}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-800 dark:text-red-200">Conversion Failed</h4>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{state.error}</p>
              <button
                onClick={handleReset}
                className="mt-4 px-4 py-2 text-sm border border-red-300 dark:border-red-600 rounded-md
                  hover:bg-red-100 dark:hover:bg-red-800/50 text-red-700 dark:text-red-300"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {state.status === 'complete' && state.result && (
        <div className="space-y-6">
          {/* Success Header */}
          <div className={`rounded-lg p-4 ${
            state.result.success
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
          }`}>
            <div className="flex items-start gap-3">
              {state.result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
              )}
              <div>
                <h4 className={`font-medium ${
                  state.result.success
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-yellow-800 dark:text-yellow-200'
                }`}>
                  {state.result.success ? 'Conversion Complete' : 'Partial Conversion'}
                </h4>
                <p className={`text-sm mt-1 ${
                  state.result.success
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-yellow-700 dark:text-yellow-300'
                }`}>
                  {state.result.success
                    ? `Successfully converted "${state.result.workflowName}" to playbook "${state.result.playbookId}"`
                    : `Converted with ${state.result.stats.unsupportedNodes} unsupported nodes`}
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Conversion Statistics</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Nodes" value={state.result.stats.totalNodes} />
                <StatCard label="Converted" value={state.result.stats.convertedNodes} variant="success" />
                <StatCard label="Partial" value={state.result.stats.partialNodes} variant="warning" />
                <StatCard label="Unsupported" value={state.result.stats.unsupportedNodes} variant="error" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                <StatCard label="Phases" value={state.result.stats.phasesGenerated} />
                <StatCard label="Steps" value={state.result.stats.stepsGenerated} />
                <StatCard label="API Routes" value={state.result.stats.apiRoutesGenerated} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                Conversion completed in {state.result.stats.conversionTimeMs}ms
              </p>
            </div>
          </div>

          {/* Details Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            {/* Tab List */}
            <div className="border-b border-gray-200 dark:border-gray-700 flex">
              <TabButton
                active={activeTab === 'files'}
                onClick={() => setActiveTab('files')}
                count={state.result.generatedFiles.length}
              >
                Generated Files
              </TabButton>
              <TabButton
                active={activeTab === 'warnings'}
                onClick={() => setActiveTab('warnings')}
                count={state.result.warnings.length}
              >
                Warnings
              </TabButton>
              <TabButton
                active={activeTab === 'env'}
                onClick={() => setActiveTab('env')}
                count={state.result.envVariables.length}
              >
                Env Variables
              </TabButton>
              {state.result.manualSteps.length > 0 && (
                <TabButton
                  active={activeTab === 'manual'}
                  onClick={() => setActiveTab('manual')}
                  count={state.result.manualSteps.length}
                >
                  Manual Steps
                </TabButton>
              )}
            </div>

            {/* Tab Content */}
            <div className="p-4 max-h-[300px] overflow-y-auto">
              {activeTab === 'files' && (
                <div className="space-y-2">
                  {state.result.generatedFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <FileJson className="h-4 w-4 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm truncate text-gray-900 dark:text-gray-100">{file.path}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{file.description}</p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                        {file.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'warnings' && (
                <div className="space-y-2">
                  {state.result.warnings.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No warnings</p>
                  ) : (
                    state.result.warnings.map((warning, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded ${
                          warning.severity === 'error'
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : warning.severity === 'warning'
                            ? 'bg-yellow-50 dark:bg-yellow-900/20'
                            : 'bg-gray-50 dark:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            warning.severity === 'error'
                              ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200'
                              : warning.severity === 'warning'
                              ? 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-200'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                          }`}>
                            {warning.severity}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm text-gray-900 dark:text-gray-100">{warning.message}</p>
                            {warning.suggestion && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {warning.suggestion}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'env' && (
                <div className="space-y-2">
                  {state.result.envVariables.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                      No environment variables required
                    </p>
                  ) : (
                    state.result.envVariables.map((env, i) => (
                      <div key={i} className="p-3 rounded bg-gray-50 dark:bg-gray-700">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm text-gray-900 dark:text-gray-100">{env.name}</code>
                          {env.required && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {env.description}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'manual' && state.result.manualSteps.length > 0 && (
                <div className="space-y-2">
                  {state.result.manualSteps.map((step, i) => (
                    <div key={i} className="p-3 rounded bg-yellow-50 dark:bg-yellow-900/20">
                      <p className="text-sm text-gray-900 dark:text-gray-100">{step}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Download Files
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <X className="h-4 w-4" />
              Import Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Sub-components
// ============================================

interface StatCardProps {
  label: string
  value: number
  variant?: 'default' | 'success' | 'warning' | 'error'
}

function StatCard({ label, value, variant = 'default' }: StatCardProps) {
  const colors = {
    default: 'text-gray-900 dark:text-gray-100',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
  }

  return (
    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${colors[variant]}`}>{value}</p>
    </div>
  )
}

interface TabButtonProps {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  count: number
}

function TabButton({ children, active, onClick, count }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      {children} ({count})
    </button>
  )
}

export default N8nImportPanel
