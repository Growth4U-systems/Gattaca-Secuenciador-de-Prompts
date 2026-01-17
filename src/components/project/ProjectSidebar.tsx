'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Building2,
  FolderOpen,
  Database,
  Book,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { Growth4ULogo } from '@/components/ui/Growth4ULogo'

interface Project {
  id: string
  name: string
  playbook_type: string
}

interface ProjectSidebarProps {
  clientId: string
  clientName: string
  clientIndustry?: string
  currentProjectId: string
  projects: Project[]
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export default function ProjectSidebar({
  clientId,
  clientName,
  clientIndustry,
  currentProjectId,
  projects,
  isCollapsed,
  onToggleCollapse,
}: ProjectSidebarProps) {
  const clientNavItems = [
    { href: `/clients/${clientId}`, label: 'Resumen', icon: LayoutDashboard },
    { href: `/clients/${clientId}?tab=context-lake`, label: 'Context Lake', icon: Database },
    { href: `/clients/${clientId}?tab=playbooks`, label: 'Playbooks', icon: Book },
    { href: `/clients/${clientId}?tab=settings`, label: 'Configuración', icon: Settings },
  ]

  // Collapsed state - show only icons
  if (isCollapsed) {
    return (
      <aside className="w-16 bg-white border-r border-gray-100 flex flex-col min-h-screen flex-shrink-0">
        {/* Logo collapsed */}
        <div className="p-3 border-b border-gray-100 flex justify-center">
          <Link href="/" className="block">
            <span className="font-bold text-lg bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">4U</span>
          </Link>
        </div>

        {/* Client icon */}
        <div className="p-3 border-b border-gray-100 flex justify-center">
          <Link
            href={`/clients/${clientId}`}
            className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl hover:from-indigo-200 hover:to-purple-200 transition-colors"
            title={clientName}
          >
            <Building2 className="w-5 h-5 text-indigo-600" />
          </Link>
        </div>

        {/* Navigation icons */}
        <nav className="flex-1 p-2 space-y-1">
          {clientNavItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex justify-center p-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                title={item.label}
              >
                <Icon size={18} />
              </Link>
            )
          })}

          {/* Projects */}
          <div className="pt-3 border-t border-gray-100 mt-3">
            {projects.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className={`flex justify-center p-2 rounded-lg transition-colors ${
                  project.id === currentProjectId
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
                title={project.name}
              >
                <FolderOpen size={16} />
              </Link>
            ))}
            <Link
              href={`/projects/new?clientId=${clientId}`}
              className="flex justify-center p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Nuevo proyecto"
            >
              <Plus size={16} />
            </Link>
          </div>
        </nav>

        {/* Expand button */}
        <div className="p-2 border-t border-gray-100">
          <button
            onClick={onToggleCollapse}
            className="w-full flex justify-center p-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            title="Expandir sidebar"
          >
            <PanelLeft size={18} />
          </button>
        </div>
      </aside>
    )
  }

  // Expanded state - full sidebar
  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col min-h-screen flex-shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-gray-100">
        <Link href="/" className="block">
          <Growth4ULogo size="lg" />
        </Link>
      </div>

      {/* Client Info */}
      <div className="p-4 border-b border-gray-100">
        <Link
          href={`/clients/${clientId}`}
          className="flex items-center gap-3 group"
        >
          <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl group-hover:from-indigo-200 group-hover:to-purple-200 transition-colors">
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
              {clientName}
            </h2>
            {clientIndustry && (
              <p className="text-xs text-gray-500 truncate">{clientIndustry}</p>
            )}
          </div>
        </Link>
      </div>

      {/* Client Navigation */}
      <nav className="flex-1 p-3">
        <div className="space-y-1">
          {clientNavItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <Icon size={18} className="text-gray-400" />
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Projects Section */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Proyectos ({projects.length})
            </span>
            <Link
              href={`/projects/new?clientId=${clientId}`}
              className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Nuevo proyecto"
            >
              <Plus size={14} />
            </Link>
          </div>
          <div className="space-y-1">
            {projects.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">Sin proyectos</p>
            ) : (
              projects.slice(0, 8).map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-xl transition-colors ${
                    project.id === currentProjectId
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <FolderOpen
                    size={14}
                    className={project.id === currentProjectId ? 'text-indigo-600' : 'text-gray-400'}
                  />
                  <span className="truncate">{project.name}</span>
                </Link>
              ))
            )}
            {projects.length > 8 && (
              <Link
                href={`/clients/${clientId}`}
                className="px-3 py-1.5 text-xs text-indigo-600 hover:text-indigo-700 block"
              >
                Ver todos ({projects.length})
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 space-y-1">
        <Link
          href="/clients"
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-colors"
        >
          <ChevronLeft size={18} className="text-gray-400" />
          Todos los clientes
        </Link>
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 rounded-xl transition-colors"
        >
          <PanelLeftClose size={18} className="text-gray-400" />
          Ocultar sidebar
        </button>
      </div>
    </aside>
  )
}
