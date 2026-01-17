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
  Plus,
  Home,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Project {
  id: string
  name: string
  playbook_type: string
}

interface ClientSidebarProps {
  clientId: string
  clientName: string
}

export default function ClientSidebar({ clientId, clientName }: ClientSidebarProps) {
  const pathname = usePathname()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, name, playbook_type')
          .eq('client_id', clientId)
          .order('updated_at', { ascending: false })
          .limit(10)

        if (error) throw error
        setProjects(data || [])
      } catch (err) {
        console.error('Error loading projects for sidebar:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [clientId])

  const navItems = [
    { href: `/clients/${clientId}`, label: 'Resumen', icon: Building2, exact: true },
    { href: `/clients/${clientId}?tab=context-lake`, label: 'Context Lake', icon: Database },
    { href: `/clients/${clientId}?tab=playbooks`, label: 'Playbooks', icon: Book },
    { href: `/clients/${clientId}?tab=settings`, label: 'Configuración', icon: Settings },
  ]

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href.split('?')[0] && !pathname?.includes('tab=')
    }
    return pathname?.startsWith(href.split('?')[0]) && href.includes(pathname || '')
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-64px)] flex-shrink-0">
      {/* Client Header */}
      <div className="p-4 border-b border-gray-100">
        <Link href="/clients" className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 mb-3">
          <Home size={14} />
          <span>Todos los clientes</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">{clientName}</h2>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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

        {/* Projects Section */}
        <div className="pt-3">
          <button
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <FolderOpen size={18} className="text-gray-400" />
              <span>Proyectos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {projects.length}
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
              ) : projects.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Sin proyectos</p>
              ) : (
                projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      pathname === `/projects/${project.id}`
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="truncate">{project.name}</div>
                    <div className="text-xs text-gray-400 truncate">{project.playbook_type}</div>
                  </Link>
                ))
              )}

              {/* New Project Button */}
              <Link
                href={`/projects/new?clientId=${clientId}`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Plus size={14} />
                <span>Nuevo proyecto</span>
              </Link>
            </div>
          )}
        </div>
      </nav>
    </aside>
  )
}
