'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  FolderOpen,
  Database,
  Book,
  Settings,
  ChevronDown,
  ChevronRight,
  Home,
  Loader2,
  FileText,
  Rocket,
  Sliders,
  Search,
  Users,
  Video,
  Table2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Project {
  id: string
  name: string
  playbook_type: string
}

interface ProjectSidebarProps {
  projectId: string
  projectName: string
  clientId: string
  clientName: string
  playbookType?: string
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function ProjectSidebar({
  projectId,
  projectName,
  clientId,
  clientName,
  playbookType,
  activeTab,
  onTabChange,
}: ProjectSidebarProps) {
  const pathname = usePathname()
  const [siblingProjects, setSiblingProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)

  useEffect(() => {
    const loadSiblingProjects = async () => {
      if (!clientId) {
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, name, playbook_type')
          .eq('client_id', clientId)
          .order('updated_at', { ascending: false })
          .limit(10)

        if (error) throw error
        setSiblingProjects(data || [])
      } catch (err) {
        console.error('Error loading sibling projects:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSiblingProjects()
  }, [clientId])

  // Determine tabs based on playbook type
  const getTabs = () => {
    if (playbookType === 'niche_finder') {
      return [
        { id: 'niche-finder', label: 'Buscador de Nichos', icon: Search },
        { id: 'documents', label: 'Documentos', icon: FileText },
      ]
    }
    if (playbookType === 'signal_based_outreach') {
      return [
        { id: 'signal-outreach', label: 'Signal Outreach', icon: Users },
        { id: 'documents', label: 'Documentos', icon: FileText },
      ]
    }
    if (playbookType === 'video_viral_ia') {
      return [
        { id: 'video-viral-ia', label: 'Video Viral IA', icon: Video },
        { id: 'documents', label: 'Documentos', icon: FileText },
        { id: 'setup', label: 'API Keys', icon: Sliders },
      ]
    }
    if (playbookType === 'ecp') {
      return [
        { id: 'documents', label: 'Documentos', icon: FileText },
        { id: 'setup', label: 'Setup', icon: Sliders },
        { id: 'campaigns', label: 'Campañas', icon: Rocket },
        { id: 'export', label: 'Export', icon: Table2 },
      ]
    }
    // Default tabs
    return [
      { id: 'documents', label: 'Documentos', icon: FileText },
      { id: 'setup', label: 'Setup', icon: Sliders },
      { id: 'campaigns', label: 'Campañas', icon: Rocket },
    ]
  }

  const tabs = getTabs()

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-64px)] flex-shrink-0 sticky top-[64px]">
      {/* Client Header */}
      <div className="p-4 border-b border-gray-100">
        <Link href="/clients" className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 mb-3">
          <Home size={14} />
          <span>Todos los clientes</span>
        </Link>

        {/* Client Info */}
        {clientId && (
          <Link
            href={`/clients/${clientId}`}
            className="flex items-center gap-3 mb-4 p-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">Cliente</p>
              <h3 className="font-medium text-gray-900 truncate text-sm">{clientName}</h3>
            </div>
          </Link>
        )}

        {/* Current Project */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">Proyecto actual</p>
            <h2 className="font-semibold text-gray-900 truncate">{projectName}</h2>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="p-3 space-y-1">
        <p className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
          Secciones
        </p>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={18} className={active ? 'text-blue-600' : 'text-gray-400'} />
              {tab.label}
            </button>
          )
        })}

        {/* Other Projects from same client */}
        {clientId && (
          <div className="pt-4 mt-4 border-t border-gray-100">
            <button
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <FolderOpen size={18} className="text-gray-400" />
                <span>Otros proyectos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {siblingProjects.filter(p => p.id !== projectId).length}
                </span>
                {projectsExpanded ? (
                  <ChevronDown size={16} className="text-gray-400" />
                ) : (
                  <ChevronRight size={16} className="text-gray-400" />
                )}
              </div>
            </button>

            {projectsExpanded && (
              <div className="mt-1 ml-6 pl-3 border-l border-gray-200 space-y-1">
                {loading ? (
                  <div className="py-2 flex items-center gap-2 text-gray-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">Cargando...</span>
                  </div>
                ) : siblingProjects.filter(p => p.id !== projectId).length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Sin otros proyectos</p>
                ) : (
                  siblingProjects
                    .filter(p => p.id !== projectId)
                    .map((project) => (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        className="block px-3 py-1.5 rounded-lg text-sm transition-colors text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      >
                        <div className="truncate">{project.name}</div>
                      </Link>
                    ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Back to Client */}
        {clientId && (
          <div className="pt-4 mt-4 border-t border-gray-100">
            <Link
              href={`/clients/${clientId}`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <Building2 size={18} className="text-gray-400" />
              Volver al cliente
            </Link>
          </div>
        )}
      </nav>
    </aside>
  )
}
