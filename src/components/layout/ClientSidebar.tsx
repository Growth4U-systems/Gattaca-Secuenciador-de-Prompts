'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Building2,
  FolderOpen,
  Database,
  Book,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Loader2,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeft,
  Rocket,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Growth4ULogo } from '@/components/ui/Growth4ULogo'

interface ProjectPlaybook {
  id: string
  playbook_type: string
  name: string
  position: number
}

interface Project {
  id: string
  name: string
  playbook_type: string
  playbooks?: ProjectPlaybook[]
}

interface Client {
  id: string
  name: string
  industry?: string | null
  status?: string
}

interface ClientSidebarProps {
  client: Client
  currentProjectId?: string
  currentPlaybookId?: string
  /** @deprecated Use currentPlaybookId instead */
  currentPlaybookType?: string
}

export default function ClientSidebar({
  client,
  currentProjectId,
  currentPlaybookId,
  currentPlaybookType,
}: ClientSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('clientSidebarCollapsed')
    if (saved !== null) {
      setIsCollapsed(saved === 'true')
    }
  }, [])

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('clientSidebarCollapsed', String(newState))
  }

  useEffect(() => {
    const loadProjects = async () => {
      try {
        // Load projects
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('id, name, playbook_type')
          .eq('client_id', client.id)
          .order('updated_at', { ascending: false })
          .limit(10)

        if (projectsError) throw projectsError

        // Load playbooks for all projects
        const projectIds = (projectsData || []).map(p => p.id)
        const { data: playbooksData, error: playbooksError } = await supabase
          .from('project_playbooks')
          .select('id, project_id, playbook_type, name, position')
          .in('project_id', projectIds)
          .order('position', { ascending: true })

        if (playbooksError) {
          console.error('Error loading playbooks:', playbooksError)
        }

        // Attach playbooks to projects
        const projectsWithPlaybooks = (projectsData || []).map(project => ({
          ...project,
          playbooks: (playbooksData || []).filter(pb => pb.project_id === project.id),
        }))

        setProjects(projectsWithPlaybooks)

        // Auto-expand current project
        if (currentProjectId) {
          setExpandedProjects(prev => new Set([...prev, currentProjectId]))
        }
      } catch (err) {
        console.error('Error loading projects for sidebar:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [client.id, currentProjectId])

  const navItems = [
    { id: 'overview', href: `/clients/${client.id}`, label: 'Resumen', icon: LayoutDashboard, exact: true },
    { id: 'context-lake', href: `/clients/${client.id}?tab=context-lake`, label: 'Context Lake', icon: Database },
    { id: 'playbooks', href: `/clients/${client.id}?tab=playbooks`, label: 'Playbooks', icon: Book },
    { id: 'settings', href: `/clients/${client.id}?tab=settings`, label: 'Configuración', icon: Settings },
  ]

  const isNavActive = (item: typeof navItems[0]) => {
    const isClientPage = pathname === `/clients/${client.id}`

    if (item.exact) {
      return isClientPage && !currentTab
    }

    const hrefTab = item.href.includes('?tab=') ? item.href.split('?tab=')[1] : null
    return isClientPage && currentTab === hrefTab
  }

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const getPlaybookLabel = (playbookType: string) => {
    const labels: Record<string, string> = {
      'ecp': 'ECP',
      'competitor_analysis': 'Competitor Analysis',
      'niche_finder': 'Niche Finder',
      'signal_based_outreach': 'Signal Outreach',
      'video_viral_ia': 'Video Viral IA',
      'seo-seed-keywords': 'SEO Keywords',
      'linkedin-post-generator': 'LinkedIn Posts',
      'github-fork-to-crm': 'Fork → CRM',
    }
    return labels[playbookType] || playbookType
  }

  if (isCollapsed) {
    return (
      <aside className="w-12 bg-white border-r border-gray-100 flex flex-col min-h-screen sticky top-0 flex-shrink-0">
        {/* Toggle Button */}
        <div className="p-2 border-b border-gray-100">
          <button
            onClick={toggleCollapsed}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Expandir sidebar"
          >
            <PanelLeft size={18} />
          </button>
        </div>

        {/* Client Icon */}
        <div className="p-2 border-b border-gray-100">
          <Link
            href={`/clients/${client.id}`}
            className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg"
            title={client.name}
          >
            <Building2 className="w-4 h-4 text-indigo-600" />
          </Link>
        </div>

        {/* Nav Icons */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isNavActive(item)
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                }`}
                title={item.label}
              >
                <Icon size={18} />
              </Link>
            )
          })}
        </nav>

        {/* Back to Clients */}
        <div className="p-2 border-t border-gray-100">
          <Link
            href="/clients"
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-lg transition-colors"
            title="Todos los clientes"
          >
            <ChevronLeft size={18} />
          </Link>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col min-h-screen sticky top-0 flex-shrink-0">
      {/* Logo + Toggle */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <Link href="/clients" className="block">
          <Growth4ULogo size="lg" />
        </Link>
        <button
          onClick={toggleCollapsed}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Colapsar sidebar"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      {/* Client Info */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">{client.name}</h2>
            {client.industry && (
              <p className="text-xs text-gray-500 truncate">{client.industry}</p>
            )}
          </div>
        </div>
        {client.status && (
          <div className="mt-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              client.status === 'active' ? 'bg-green-100 text-green-700' :
              client.status === 'inactive' ? 'bg-gray-100 text-gray-600' :
              'bg-amber-100 text-amber-700'
            }`}>
              {client.status === 'active' ? 'Activo' :
               client.status === 'inactive' ? 'Inactivo' : 'Archivado'}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isNavActive(item)
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} className={active ? 'text-indigo-600' : 'text-gray-400'} />
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Projects Section */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 mb-2">
            <button
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
            >
              <span>Proyectos ({projects.length})</span>
              {projectsExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
            <Link
              href={`/projects/new?clientId=${client.id}`}
              className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Nuevo proyecto"
            >
              <Plus size={14} />
            </Link>
          </div>

          {projectsExpanded && (
            <div className="space-y-1">
              {loading ? (
                <div className="px-3 py-2">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
              ) : projects.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">Sin proyectos</p>
              ) : (
                projects.map((project) => {
                  const isCurrentProject = currentProjectId === project.id || pathname === `/projects/${project.id}`
                  const isExpanded = expandedProjects.has(project.id)
                  const hasPlaybooks = project.playbooks && project.playbooks.length > 0

                  return (
                    <div key={project.id}>
                      <div className="flex items-center gap-1">
                        {hasPlaybooks && (
                          <button
                            onClick={() => toggleProjectExpanded(project.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded"
                          >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                        )}
                        <Link
                          href={`/projects/${project.id}`}
                          className={`flex-1 flex items-center gap-2 px-2 py-2 text-sm rounded-xl transition-colors ${
                            isCurrentProject
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          } ${!hasPlaybooks ? 'ml-5' : ''}`}
                        >
                          <FolderOpen size={14} className={isCurrentProject ? 'text-blue-500' : 'text-gray-400'} />
                          <span className="truncate">{project.name}</span>
                        </Link>
                      </div>

                      {/* Playbooks nested under project */}
                      {hasPlaybooks && isExpanded && (
                        <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-2">
                          {project.playbooks!.map((playbook) => {
                            const isCurrentPlaybook = currentProjectId === project.id &&
                              (currentPlaybookId === playbook.id ||
                               currentPlaybookType === playbook.playbook_type ||
                               currentPlaybookType === playbook.playbook_type.replace('_', '-') ||
                               currentPlaybookType === playbook.playbook_type.replace('-', '_'))
                            return (
                              <Link
                                key={playbook.id}
                                href={`/projects/${project.id}/playbooks/${playbook.id}`}
                                className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors ${
                                  isCurrentPlaybook
                                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <Rocket size={12} className={isCurrentPlaybook ? 'text-indigo-500' : 'text-gray-400'} />
                                <span className="truncate">{playbook.name || getPlaybookLabel(playbook.playbook_type)}</span>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Back to Clients */}
      <div className="p-3 border-t border-gray-100">
        <Link
          href="/clients"
          className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-colors"
        >
          <ChevronLeft size={18} className="text-gray-400" />
          Todos los clientes
        </Link>
      </div>
    </aside>
  )
}
