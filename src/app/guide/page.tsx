'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  Rocket,
  FolderOpen,
  FileText,
  Workflow,
  Database,
  Play,
  Cpu,
  DollarSign,
  BarChart3,
  Variable,
  Share2,
  Lightbulb,
  AlertTriangle,
  ChevronRight,
  Zap,
  Check,
  ExternalLink
} from 'lucide-react'

const sections = [
  { id: 'que-es-gattaca', title: 'Que es Gattaca?', icon: BookOpen, emoji: '🧬' },
  { id: 'primeros-pasos', title: 'Primeros Pasos', icon: Rocket, emoji: '🚀' },
  { id: 'proyectos', title: 'Gestion de Proyectos', icon: FolderOpen, emoji: '📁' },
  { id: 'documentos', title: 'Base de Conocimiento', icon: FileText, emoji: '📄' },
  { id: 'flujos', title: 'Flujos y Steps', icon: Workflow, emoji: '🔄' },
  { id: 'rag', title: 'RAG vs Documento Completo', icon: Database, emoji: '⚡' },
  { id: 'campanas', title: 'Campanas y Ejecucion', icon: Play, emoji: '▶️' },
  { id: 'modelos', title: 'Modelos Disponibles', icon: Cpu, emoji: '🤖' },
  { id: 'costos', title: 'Optimizacion de Costos', icon: DollarSign, emoji: '💰' },
  { id: 'dashboard', title: 'Dashboard de Uso', icon: BarChart3, emoji: '📊' },
  { id: 'variables', title: 'Variables del Proyecto', icon: Variable, emoji: '🔧' },
  { id: 'compartir', title: 'Compartir Proyectos', icon: Share2, emoji: '🔗' },
  { id: 'tips', title: 'Tips y Mejores Practicas', icon: Lightbulb, emoji: '💡' },
  { id: 'problemas', title: 'Solucion de Problemas', icon: AlertTriangle, emoji: '🔧' },
]

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('que-es-gattaca')

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId)
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-200 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={18} />
            <span>Volver a Proyectos</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 backdrop-blur rounded-xl">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Instructivo Gattaca</h1>
              <p className="text-blue-200 mt-1">Guia completa para dominar el secuenciador de prompts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar - Table of Contents */}
          <nav className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-24 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>📌</span> Indice
              </h2>
              <ul className="space-y-1">
                {sections.map((section) => (
                  <li key={section.id}>
                    <button
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                        activeSection === section.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span>{section.emoji}</span>
                      <span className="truncate">{section.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Mobile TOC */}
            <div className="lg:hidden mb-6 bg-white rounded-xl border border-gray-100 p-4">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="font-semibold text-gray-900 flex items-center gap-2">
                    <span>📌</span> Indice
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
                </summary>
                <ul className="mt-4 space-y-1">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <button
                        onClick={() => scrollToSection(section.id)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span>{section.emoji}</span>
                        <span>{section.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </div>

            {/* Content Sections */}
            <div className="space-y-12">
              {/* Section 1: Que es Gattaca */}
              <section id="que-es-gattaca" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">🧬</span>
                      Que es Gattaca?
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-gray-700 leading-relaxed">
                      <strong>Gattaca</strong> es un <strong>secuenciador de prompts</strong> que te permite crear flujos de trabajo con IA de manera visual y estructurada. Piensa en el como un "workflow builder" para automatizar tareas complejas que requieren multiples pasos de procesamiento con modelos de lenguaje.
                    </p>

                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <h4 className="font-semibold text-blue-900 mb-2">Casos de uso principales:</h4>
                      <ul className="space-y-2 text-blue-800">
                        <li className="flex items-start gap-2">
                          <Check size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                          <span><strong>Analisis de documentos:</strong> Procesar briefings, reportes, estudios de mercado</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                          <span><strong>Generacion de contenido:</strong> Crear estrategias, campanas, copys basados en contexto</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                          <span><strong>Investigacion:</strong> Extraer insights de multiples fuentes de manera estructurada</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                          <span><strong>Automatizacion:</strong> Ejecutar secuencias de prompts donde cada paso alimenta al siguiente</span>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                      <p className="text-indigo-800">
                        <strong>Analogia:</strong> Si un prompt individual es como hacer una pregunta, Gattaca es como tener una conversacion estructurada donde cada respuesta informa la siguiente pregunta, todo organizado en un flujo visual.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: Primeros Pasos */}
              <section id="primeros-pasos" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">🚀</span>
                      Primeros Pasos
                    </h2>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">1</span>
                        Configurar OpenRouter
                      </h3>
                      <p className="text-gray-700 ml-8">
                        Al iniciar sesion por primera vez, se te pedira conectar tu cuenta de <strong>OpenRouter</strong>. Este servicio te permite acceder a multiples modelos de IA (Gemini, GPT-4, Claude) con una sola API key.
                      </p>
                      <div className="ml-8 bg-amber-50 rounded-lg p-3 border border-amber-100">
                        <p className="text-amber-800 text-sm">
                          <strong>Nota:</strong> Necesitas tener creditos en OpenRouter para ejecutar prompts. Puedes cargar creditos desde su dashboard.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">2</span>
                        Crear tu primer proyecto
                      </h3>
                      <p className="text-gray-700 ml-8">
                        Haz click en <strong>"Nuevo Proyecto"</strong> desde la pagina principal. Dale un nombre descriptivo y opcionalmente asignalo a un cliente.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">3</span>
                        Subir documentos base
                      </h3>
                      <p className="text-gray-700 ml-8">
                        En la pestana <strong>"Documentos"</strong>, sube los archivos que serviran como contexto para tus prompts: PDFs, Word, TXT, etc.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">4</span>
                        Disenar tu flujo
                      </h3>
                      <p className="text-gray-700 ml-8">
                        En la pestana <strong>"Flujo"</strong>, crea los steps (pasos) de tu proceso. Cada step tiene un prompt, documentos asociados y puede recibir el output de steps anteriores.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">5</span>
                        Ejecutar
                      </h3>
                      <p className="text-gray-700 ml-8">
                        En la pestana <strong>"Campanas"</strong>, crea una campana y ejecuta los steps. Puedes ejecutarlos uno por uno o en secuencia.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 3: Proyectos */}
              <section id="proyectos" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-purple-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">📁</span>
                      Gestion de Proyectos
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-gray-700">
                      Los <strong>proyectos</strong> son el contenedor principal de tu trabajo en Gattaca. Cada proyecto tiene sus propios documentos, flujos, variables y campanas.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Crear proyecto</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li>• Click en "Nuevo Proyecto"</li>
                          <li>• Asigna nombre y descripcion</li>
                          <li>• Opcionalmente asigna un cliente</li>
                        </ul>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Organizar por cliente</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li>• Crea clientes para agrupar proyectos</li>
                          <li>• Visualiza proyectos por cliente</li>
                          <li>• Facilita la busqueda</li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                      <h4 className="font-semibold text-red-900 mb-2">Papelera</h4>
                      <p className="text-red-800 text-sm">
                        Los proyectos eliminados van a la papelera donde puedes restaurarlos o eliminarlos permanentemente. Accede desde el icono de papelera en la pagina principal.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Documentos */}
              <section id="documentos" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b border-orange-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">📄</span>
                      Base de Conocimiento (Documentos)
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-gray-700">
                      La <strong>base de conocimiento</strong> es donde subes los documentos que serviran como contexto para tus prompts.
                    </p>

                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <h4 className="font-semibold text-blue-900 mb-2">Formatos soportados:</h4>
                      <div className="flex flex-wrap gap-2">
                        {['PDF', 'DOCX', 'DOC', 'TXT', 'MD', 'CSV', 'XLSX'].map(format => (
                          <span key={format} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                            {format}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-900">Categorias de documentos:</h4>
                      <div className="grid md:grid-cols-2 gap-3">
                        {[
                          { name: 'Brief', desc: 'Briefings del cliente, requerimientos' },
                          { name: 'Contexto', desc: 'Informacion de fondo, historia' },
                          { name: 'Referencia', desc: 'Materiales de referencia, ejemplos' },
                          { name: 'Datos', desc: 'Estadisticas, reportes, metricas' },
                          { name: 'Otro', desc: 'Cualquier otro tipo de documento' },
                        ].map(cat => (
                          <div key={cat.name} className="bg-gray-50 rounded-lg p-3">
                            <span className="font-medium text-gray-900">{cat.name}:</span>
                            <span className="text-gray-600 text-sm ml-1">{cat.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <h4 className="font-semibold text-amber-900 mb-2">Tokens y costos</h4>
                      <p className="text-amber-800 text-sm">
                        Cada documento muestra su conteo de <strong>tokens</strong>. Los tokens son las unidades que los modelos de IA usan para procesar texto. Un documento de 50,000 tokens enviado completo a Gemini 2.5 Flash costaria aproximadamente $0.015 USD.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 5: Flujos */}
              <section id="flujos" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-50 to-blue-50 px-6 py-4 border-b border-cyan-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">🔄</span>
                      Flujos y Steps
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-gray-700">
                      Un <strong>flujo</strong> es una secuencia de <strong>steps</strong> (pasos) que procesan informacion en orden. Cada step tiene su propio prompt y puede usar documentos y outputs de steps anteriores.
                    </p>

                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl p-4 border border-cyan-200">
                      <h4 className="font-semibold text-cyan-900 mb-3">Anatomia de un Step:</h4>
                      <ul className="space-y-2 text-cyan-800">
                        <li><strong>Nombre:</strong> Identificador descriptivo del paso</li>
                        <li><strong>Prompt:</strong> Las instrucciones para el modelo de IA</li>
                        <li><strong>Documentos base:</strong> Documentos que se enviaran como contexto</li>
                        <li><strong>Recibir de:</strong> Steps anteriores cuyo output se incluira</li>
                        <li><strong>Modelo:</strong> Que modelo de IA usar (Gemini, GPT, Claude)</li>
                        <li><strong>Modo de documentos:</strong> Completo o RAG (chunks)</li>
                      </ul>
                    </div>

                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                      <h4 className="font-semibold text-indigo-900 mb-2">Conexiones entre steps</h4>
                      <p className="text-indigo-800 text-sm">
                        Usa <strong>"Recibir de"</strong> para conectar steps. Por ejemplo, si el Step 2 debe usar el output del Step 1, configura Step 2 para "recibir de" Step 1. Esto permite crear cadenas de procesamiento donde cada paso refina o expande el resultado anterior.
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Ejemplo de flujo:</h4>
                      <div className="flex items-center gap-2 text-sm overflow-x-auto pb-2">
                        <div className="flex-shrink-0 bg-blue-100 text-blue-800 px-3 py-2 rounded-lg">
                          Step 1: Analisis
                        </div>
                        <ChevronRight className="text-gray-400 flex-shrink-0" />
                        <div className="flex-shrink-0 bg-green-100 text-green-800 px-3 py-2 rounded-lg">
                          Step 2: Sintesis
                        </div>
                        <ChevronRight className="text-gray-400 flex-shrink-0" />
                        <div className="flex-shrink-0 bg-purple-100 text-purple-800 px-3 py-2 rounded-lg">
                          Step 3: Recomendaciones
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 6: RAG vs Documento Completo */}
              <section id="rag" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 px-6 py-4 border-b border-yellow-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">⚡</span>
                      RAG vs Documento Completo
                      <span className="ml-2 px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs font-medium rounded-full">IMPORTANTE</span>
                    </h2>
                  </div>
                  <div className="p-6 space-y-6">
                    <p className="text-gray-700">
                      Esta es una de las decisiones mas importantes para <strong>optimizar costos</strong>. Cada step puede procesar documentos de dos formas:
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Documento Completo */}
                      <div className="bg-blue-50 rounded-xl p-5 border-2 border-blue-200">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="text-blue-600" size={24} />
                          <h4 className="font-bold text-blue-900">Documento Completo</h4>
                        </div>
                        <p className="text-blue-800 text-sm mb-3">
                          Envia el documento entero al modelo de IA.
                        </p>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-green-700">
                            <Check size={16} />
                            <span>Analisis holistico</span>
                          </div>
                          <div className="flex items-center gap-2 text-green-700">
                            <Check size={16} />
                            <span>Comparaciones completas</span>
                          </div>
                          <div className="flex items-center gap-2 text-green-700">
                            <Check size={16} />
                            <span>Sintesis integral</span>
                          </div>
                          <div className="flex items-center gap-2 text-amber-700 mt-3">
                            <DollarSign size={16} />
                            <span>Mayor costo (mas tokens)</span>
                          </div>
                        </div>
                        <div className="mt-4 p-2 bg-blue-100 rounded-lg">
                          <p className="text-xs text-blue-800">
                            <strong>Usar cuando:</strong> Necesitas vision completa del documento, hacer comparaciones, o generar sintesis que requiera todo el contexto.
                          </p>
                        </div>
                      </div>

                      {/* RAG */}
                      <div className="bg-green-50 rounded-xl p-5 border-2 border-green-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Zap className="text-green-600" size={24} />
                          <h4 className="font-bold text-green-900">RAG (Chunks Relevantes)</h4>
                        </div>
                        <p className="text-green-800 text-sm mb-3">
                          Envia solo las secciones mas relevantes al prompt.
                        </p>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-green-700">
                            <Check size={16} />
                            <span>Busquedas especificas</span>
                          </div>
                          <div className="flex items-center gap-2 text-green-700">
                            <Check size={16} />
                            <span>Extraccion de datos</span>
                          </div>
                          <div className="flex items-center gap-2 text-green-700">
                            <Check size={16} />
                            <span>90-95% ahorro en costos</span>
                          </div>
                          <div className="flex items-center gap-2 text-green-700 mt-3">
                            <DollarSign size={16} />
                            <span>Mucho menor costo</span>
                          </div>
                        </div>
                        <div className="mt-4 p-2 bg-green-100 rounded-lg">
                          <p className="text-xs text-green-800">
                            <strong>Usar cuando:</strong> Tienes preguntas puntuales, buscas datos especificos, o el documento es muy largo y solo necesitas partes.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
                      <h4 className="font-semibold text-amber-900 mb-2">Configuracion RAG</h4>
                      <ul className="text-amber-800 text-sm space-y-1">
                        <li><strong>top_k:</strong> Cantidad de chunks a recuperar (3-30). Mas chunks = mas contexto pero mas costo.</li>
                        <li><strong>min_score:</strong> Score minimo de relevancia (0.5-0.95). Mayor score = chunks mas relevantes pero menos resultados.</li>
                      </ul>
                    </div>

                    <div className="bg-gray-900 rounded-xl p-4 text-white">
                      <h4 className="font-semibold mb-2">Ejemplo de ahorro:</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Documento de 80,000 tokens</p>
                          <p className="text-gray-400">Modelo: Gemini 2.5 Flash</p>
                        </div>
                        <div className="text-right">
                          <p><span className="text-red-400">Completo:</span> ~$0.024</p>
                          <p><span className="text-green-400">RAG (10 chunks):</span> ~$0.0015</p>
                          <p className="text-yellow-400 font-bold mt-1">Ahorro: 94%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 7: Campanas */}
              <section id="campanas" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-4 border-b border-emerald-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">▶️</span>
                      Campanas y Ejecucion
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-gray-700">
                      Una <strong>campana</strong> es una instancia de ejecucion de tu flujo. Puedes tener multiples campanas del mismo flujo, cada una con sus propios resultados.
                    </p>

                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Crear campana</h4>
                        <p className="text-gray-600 text-sm">
                          En la pestana "Campanas", haz click en "Nueva Campana". Dale un nombre descriptivo (ej: "Campana Q1 2024").
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Ejecutar steps</h4>
                        <p className="text-gray-600 text-sm">
                          Puedes ejecutar steps de forma individual haciendo click en "Ejecutar" en cada uno, o ejecutar todo el flujo en secuencia.
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Ver resultados</h4>
                        <p className="text-gray-600 text-sm">
                          El output de cada step se guarda y puedes verlo expandiendo el step. Tambien puedes copiar el resultado o descargarlo.
                        </p>
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <h4 className="font-semibold text-blue-900 mb-2">Modal de confirmacion</h4>
                      <p className="text-blue-800 text-sm">
                        Antes de ejecutar, veras un modal mostrando el <strong>costo estimado</strong> y podras elegir entre modo RAG o Documento Completo. Esto te permite optimizar costos antes de cada ejecucion.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 8: Modelos */}
              <section id="modelos" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-6 py-4 border-b border-violet-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">🤖</span>
                      Modelos Disponibles
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-gray-700">
                      Gattaca usa <strong>OpenRouter</strong> para acceder a multiples modelos de IA. Cada modelo tiene diferentes capacidades y precios.
                    </p>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left p-3 font-semibold text-gray-900">Modelo</th>
                            <th className="text-left p-3 font-semibold text-gray-900">Input ($/M)</th>
                            <th className="text-left p-3 font-semibold text-gray-900">Output ($/M)</th>
                            <th className="text-left p-3 font-semibold text-gray-900">Mejor para</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr>
                            <td className="p-3 font-medium">Gemini 2.5 Flash</td>
                            <td className="p-3 text-green-600">$0.30</td>
                            <td className="p-3 text-green-600">$2.50</td>
                            <td className="p-3 text-gray-600">Tareas generales, mejor balance costo/calidad</td>
                          </tr>
                          <tr className="bg-gray-50/50">
                            <td className="p-3 font-medium">Gemini 2.5 Pro</td>
                            <td className="p-3 text-amber-600">$1.25</td>
                            <td className="p-3 text-amber-600">$10.00</td>
                            <td className="p-3 text-gray-600">Analisis complejos, razonamiento avanzado</td>
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">GPT-4o</td>
                            <td className="p-3 text-amber-600">$2.50</td>
                            <td className="p-3 text-amber-600">$10.00</td>
                            <td className="p-3 text-gray-600">Creatividad, escritura, instrucciones complejas</td>
                          </tr>
                          <tr className="bg-gray-50/50">
                            <td className="p-3 font-medium">GPT-4o Mini</td>
                            <td className="p-3 text-green-600">$0.15</td>
                            <td className="p-3 text-green-600">$0.60</td>
                            <td className="p-3 text-gray-600">Tareas simples, alto volumen, bajo costo</td>
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">Claude Sonnet 4</td>
                            <td className="p-3 text-amber-600">$3.00</td>
                            <td className="p-3 text-amber-600">$15.00</td>
                            <td className="p-3 text-gray-600">Analisis largos, seguir instrucciones precisas</td>
                          </tr>
                          <tr className="bg-gray-50/50">
                            <td className="p-3 font-medium">Claude Haiku</td>
                            <td className="p-3 text-green-600">$1.00</td>
                            <td className="p-3 text-green-600">$5.00</td>
                            <td className="p-3 text-gray-600">Respuestas rapidas, extraccion de datos</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                      <h4 className="font-semibold text-green-900 mb-2">Recomendacion</h4>
                      <p className="text-green-800 text-sm">
                        Para la mayoria de casos, <strong>Gemini 2.5 Flash</strong> ofrece el mejor balance entre calidad y costo. Usa modelos Pro/GPT-4o solo cuando necesites capacidades avanzadas de razonamiento.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 9: Costos */}
              <section id="costos" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">💰</span>
                      Optimizacion de Costos
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-gray-700">
                      El costo de usar modelos de IA se basa en <strong>tokens</strong> procesados. Aqui hay estrategias para minimizar costos:
                    </p>

                    <div className="space-y-3">
                      <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                        <h4 className="font-semibold text-green-900 flex items-center gap-2">
                          <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">1</span>
                          Usa RAG para documentos grandes
                        </h4>
                        <p className="text-green-800 text-sm mt-2">
                          Si tienes documentos de mas de 20,000 tokens y solo necesitas informacion especifica, usa modo RAG para ahorrar hasta 95%.
                        </p>
                      </div>

                      <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                        <h4 className="font-semibold text-green-900 flex items-center gap-2">
                          <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">2</span>
                          Selecciona el modelo adecuado
                        </h4>
                        <p className="text-green-800 text-sm mt-2">
                          No uses GPT-4o para tareas simples. Gemini Flash o GPT-4o Mini son suficientes para la mayoria de casos y cuestan 10x menos.
                        </p>
                      </div>

                      <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                        <h4 className="font-semibold text-green-900 flex items-center gap-2">
                          <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">3</span>
                          Optimiza tus documentos
                        </h4>
                        <p className="text-green-800 text-sm mt-2">
                          Elimina contenido innecesario de los documentos antes de subirlos. Menos tokens = menos costo.
                        </p>
                      </div>

                      <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                        <h4 className="font-semibold text-green-900 flex items-center gap-2">
                          <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">4</span>
                          Aprovecha el caching
                        </h4>
                        <p className="text-green-800 text-sm mt-2">
                          OpenRouter cachea automaticamente contextos repetidos. Si ejecutas el mismo step varias veces, el costo puede reducirse.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 10: Dashboard */}
              <section id="dashboard" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-indigo-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">📊</span>
                      Dashboard de Uso
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-gray-700">
                      Gattaca registra automaticamente cada ejecucion y su costo. Puedes ver estadisticas desde el badge de OpenRouter en el header.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Metricas disponibles:</h4>
                        <ul className="text-gray-600 text-sm space-y-1">
                          <li>• Gasto total acumulado</li>
                          <li>• Gasto hoy / esta semana / este mes</li>
                          <li>• Tokens procesados</li>
                          <li>• Desglose por modelo</li>
                        </ul>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Comparativas:</h4>
                        <ul className="text-gray-600 text-sm space-y-1">
                          <li>• RAG vs Documento Completo</li>
                          <li>• Ahorro por caching</li>
                          <li>• Costo promedio por ejecucion</li>
                          <li>• Actividad reciente</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 11: Variables */}
              <section id="variables" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-50 to-cyan-50 px-6 py-4 border-b border-teal-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">🔧</span>
                      Variables del Proyecto
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-gray-700">
                      Las <strong>variables</strong> te permiten definir valores reutilizables que puedes usar en tus prompts.
                    </p>

                    <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
                      <h4 className="font-semibold text-teal-900 mb-2">Como usar variables:</h4>
                      <ol className="text-teal-800 text-sm space-y-2">
                        <li>1. Ve a la pestana "Variables" en tu proyecto</li>
                        <li>2. Define variables con nombre y valor (ej: <code className="bg-teal-100 px-1 rounded">nombre_marca = "Acme Corp"</code>)</li>
                        <li>3. En tus prompts, usa <code className="bg-teal-100 px-1 rounded">{"{{nombre_marca}}"}</code> para insertar el valor</li>
                      </ol>
                    </div>

                    <div className="bg-gray-900 rounded-xl p-4 text-white">
                      <h4 className="font-semibold mb-2">Ejemplo:</h4>
                      <p className="text-gray-300 text-sm font-mono">
                        Analiza el briefing de <span className="text-green-400">{"{{nombre_marca}}"}</span> y extrae los objetivos principales para la campana de <span className="text-green-400">{"{{temporada}}"}</span>.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 12: Compartir */}
              <section id="compartir" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-pink-50 to-rose-50 px-6 py-4 border-b border-pink-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">🔗</span>
                      Compartir Proyectos
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-gray-700">
                      Puedes invitar a otros usuarios a colaborar en tus proyectos.
                    </p>

                    <div className="bg-pink-50 rounded-xl p-4 border border-pink-100">
                      <h4 className="font-semibold text-pink-900 mb-2">Como compartir:</h4>
                      <ol className="text-pink-800 text-sm space-y-2">
                        <li>1. Abre el proyecto que quieres compartir</li>
                        <li>2. Haz click en el boton "Compartir" (icono de enlace)</li>
                        <li>3. Se genera un link de invitacion unico</li>
                        <li>4. Comparte el link con tu colaborador</li>
                        <li>5. Cuando acceden al link, se unen al proyecto</li>
                      </ol>
                    </div>

                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <p className="text-amber-800 text-sm">
                        <strong>Nota:</strong> Los colaboradores usan su propia cuenta de OpenRouter para ejecutar prompts. Cada usuario paga sus propias ejecuciones.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 13: Tips */}
              <section id="tips" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-50 to-amber-50 px-6 py-4 border-b border-yellow-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">💡</span>
                      Tips y Mejores Practicas
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Escribe prompts claros</h4>
                        <ul className="text-gray-600 text-sm space-y-1">
                          <li>• Se especifico sobre lo que quieres</li>
                          <li>• Define el formato de salida esperado</li>
                          <li>• Incluye ejemplos cuando sea util</li>
                          <li>• Divide tareas complejas en steps mas pequenos</li>
                        </ul>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Organiza tus documentos</h4>
                        <ul className="text-gray-600 text-sm space-y-1">
                          <li>• Usa categorias para clasificar</li>
                          <li>• Nombra archivos de forma descriptiva</li>
                          <li>• Elimina contenido redundante</li>
                          <li>• Agrupa documentos relacionados</li>
                        </ul>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Disena flujos eficientes</h4>
                        <ul className="text-gray-600 text-sm space-y-1">
                          <li>• Empieza con analisis, termina con sintesis</li>
                          <li>• Cada step debe tener un proposito claro</li>
                          <li>• Usa "recibir de" para crear cadenas logicas</li>
                          <li>• Prueba steps individuales antes de ejecutar todo</li>
                        </ul>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Optimiza costos</h4>
                        <ul className="text-gray-600 text-sm space-y-1">
                          <li>• Usa RAG cuando no necesites contexto completo</li>
                          <li>• Elige el modelo mas economico que cumpla tu necesidad</li>
                          <li>• Revisa el dashboard periodicamente</li>
                          <li>• Elimina documentos que ya no uses</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 14: Problemas */}
              <section id="problemas" className="scroll-mt-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b border-red-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="text-2xl">🔧</span>
                      Solucion de Problemas
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="space-y-4">
                      <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                        <h4 className="font-semibold text-red-900 mb-2">"Error de conexion con OpenRouter"</h4>
                        <ul className="text-red-800 text-sm space-y-1">
                          <li>• Verifica que tu API key este configurada correctamente</li>
                          <li>• Revisa que tengas creditos disponibles en OpenRouter</li>
                          <li>• Intenta reconectar desde el badge de OpenRouter</li>
                        </ul>
                      </div>

                      <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                        <h4 className="font-semibold text-red-900 mb-2">"Timeout al ejecutar step"</h4>
                        <ul className="text-red-800 text-sm space-y-1">
                          <li>• Los documentos muy grandes pueden causar timeouts</li>
                          <li>• Intenta usar modo RAG para reducir contexto</li>
                          <li>• Divide el step en pasos mas pequenos</li>
                          <li>• Verifica tu conexion a internet</li>
                        </ul>
                      </div>

                      <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                        <h4 className="font-semibold text-red-900 mb-2">"Documento muy grande para subir"</h4>
                        <ul className="text-red-800 text-sm space-y-1">
                          <li>• El limite es de aproximadamente 25MB por archivo</li>
                          <li>• Intenta comprimir PDFs o dividir documentos</li>
                          <li>• Elimina imagenes innecesarias de documentos</li>
                        </ul>
                      </div>

                      <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                        <h4 className="font-semibold text-red-900 mb-2">"El modelo no sigue las instrucciones"</h4>
                        <ul className="text-red-800 text-sm space-y-1">
                          <li>• Se mas especifico en tu prompt</li>
                          <li>• Usa un modelo mas avanzado (GPT-4o, Claude Sonnet)</li>
                          <li>• Incluye ejemplos del output esperado</li>
                          <li>• Divide la tarea en steps mas simples</li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <h4 className="font-semibold text-blue-900 mb-2">Necesitas mas ayuda?</h4>
                      <p className="text-blue-800 text-sm">
                        Si tienes problemas que no puedes resolver, contacta al equipo de soporte o revisa la documentacion tecnica.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

            </div>

            {/* Footer */}
            <div className="mt-12 text-center text-gray-500 text-sm">
              <p>Gattaca - Secuenciador de Prompts</p>
              <p className="mt-1">Desarrollado por G4U Systems</p>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
