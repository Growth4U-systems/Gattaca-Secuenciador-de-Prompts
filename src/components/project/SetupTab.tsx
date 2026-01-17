'use client'

import { useState } from 'react'
import { Sliders, Workflow, ChevronDown, ChevronRight } from 'lucide-react'
import ProjectVariables from './ProjectVariables'
import FlowSetup from '@/components/flow/FlowSetup'

type SubTab = 'variables' | 'flow'

interface SetupTabProps {
  projectId: string
  initialVariables: any[]
  documents: any[]
  onVariablesUpdate?: () => void
  userRole?: string | null
}

export default function SetupTab({
  projectId,
  initialVariables,
  documents,
  onVariablesUpdate,
}: SetupTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('variables')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const toggleSection = (section: string) => {
    const newCollapsed = new Set(collapsedSections)
    if (newCollapsed.has(section)) {
      newCollapsed.delete(section)
    } else {
      newCollapsed.add(section)
    }
    setCollapsedSections(newCollapsed)
  }

  const subTabs = [
    { id: 'variables' as SubTab, label: 'Variables', icon: Sliders, description: 'Configura las variables del proyecto' },
    { id: 'flow' as SubTab, label: 'Flujo de Prompts', icon: Workflow, description: 'Define los pasos y prompts' },
  ]

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        {subTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeSubTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
              <span className="font-medium text-sm">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Sub-tab description */}
      <div className="text-sm text-gray-500">
        {subTabs.find(t => t.id === activeSubTab)?.description}
      </div>

      {/* Content */}
      {activeSubTab === 'variables' && (
        <ProjectVariables
          projectId={projectId}
          initialVariables={initialVariables}
          onUpdate={onVariablesUpdate}
        />
      )}

      {activeSubTab === 'flow' && (
        <FlowSetup projectId={projectId} documents={documents} />
      )}
    </div>
  )
}
