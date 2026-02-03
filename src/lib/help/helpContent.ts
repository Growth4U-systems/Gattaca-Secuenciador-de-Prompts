/**
 * Help Content - Spanish
 *
 * Centralized help content for Gattaca.
 * All text is in Spanish for the target audience.
 */

export interface HelpTopic {
  id: string
  title: string
  icon: string
  shortDescription: string
  content: HelpSection[]
  relatedTopics?: string[]
}

export interface HelpSection {
  title?: string
  content: string
}

export const HELP_TOPICS: Record<string, HelpTopic> = {
  'getting-started': {
    id: 'getting-started',
    title: 'Primeros Pasos',
    icon: '🚀',
    shortDescription: 'Aprende lo basico de Gattaca',
    content: [
      {
        title: 'Que es Gattaca?',
        content: `Gattaca es un secuenciador de prompts que te permite ejecutar flujos de trabajo de IA de forma sistematica. Puedes crear campanas, configurar variables, y ejecutar pasos que se alimentan entre si.`,
      },
      {
        title: 'Flujo basico',
        content: `1. **Crear un proyecto** - Organiza tu trabajo por cliente o tema
2. **Subir documentos** - Agrega contexto para tus prompts
3. **Configurar variables** - Define valores que se usaran en los prompts
4. **Crear una campana** - Selecciona un playbook o crea uno personalizado
5. **Ejecutar pasos** - Corre cada paso del flujo secuencialmente`,
      },
    ],
    relatedTopics: ['variables', 'documents', 'campaigns'],
  },

  variables: {
    id: 'variables',
    title: 'Variables',
    icon: '🔤',
    shortDescription: 'Como usar variables en tus prompts',
    content: [
      {
        title: 'Sintaxis',
        content: `Las variables usan doble llave: \`{{ nombre_variable }}\`

Ejemplos:
- \`{{ competitor_name }}\` - Nombre del competidor
- \`{{ product }}\` - Tu producto o servicio
- \`{{ industry }}\` - La industria objetivo`,
      },
      {
        title: 'Autocompletado',
        content: `Escribe \`{{\` en cualquier prompt para ver el autocompletado de variables disponibles. Usa las flechas ↑↓ para navegar y Enter para seleccionar.`,
      },
      {
        title: 'Colores en el editor',
        content: `El editor muestra las variables con colores:
- **Indigo**: Variable declarada y valida
- **Rojo**: Variable no declarada
- **Ambar**: Posible error de tipeo
- **Morado**: Referencia a otro paso (step:)`,
      },
      {
        title: 'Referencias a pasos',
        content: `Puedes usar el output de pasos anteriores con la sintaxis especial:
\`{{ step:NombreDelPaso }}\`

Esto inyectara el resultado del paso indicado en tu prompt actual.`,
      },
    ],
    relatedTopics: ['step-editor', 'campaigns'],
  },

  documents: {
    id: 'documents',
    title: 'Documentos',
    icon: '📄',
    shortDescription: 'Gestion de documentos y contexto',
    content: [
      {
        title: 'Formatos soportados',
        content: `Gattaca soporta los siguientes formatos:
- **PDF** - Documentos, reportes, presentaciones
- **DOCX** - Documentos de Word
- **TXT** - Archivos de texto plano
- **MD** - Archivos Markdown
- **CSV** - Tablas y datos estructurados
- **JSON** - Datos estructurados`,
      },
      {
        title: 'Convencion de nombres',
        content: `Para mejor organizacion, usa el formato:
**Fuente - Objetivo - YYYY-MM-DD**

Ejemplos:
- "Website Content - Acme Corp - 2026-02-03"
- "Trustpilot Reviews - Competidor A - 2026-01-15"

El sistema mostrara un badge indicando si el nombre sigue la convencion.`,
      },
      {
        title: 'Categorias',
        content: `Organiza tus documentos por categoria:
- **Producto**: Info sobre tu producto/servicio
- **Competidor**: Analisis de competencia
- **Research**: Investigacion de mercado
- **Output**: Resultados de pasos ejecutados`,
      },
      {
        title: 'Scrapers automaticos',
        content: `Gattaca puede extraer documentos automaticamente de:
- Sitios web (Firecrawl)
- Redes sociales (Instagram, TikTok, LinkedIn, etc.)
- Reviews (Trustpilot, G2, App Store, etc.)
- SEO y keywords`,
      },
    ],
    relatedTopics: ['getting-started', 'campaigns'],
  },

  campaigns: {
    id: 'campaigns',
    title: 'Campanas',
    icon: '🎯',
    shortDescription: 'Ejecutar flujos de trabajo',
    content: [
      {
        title: 'Que es una campana?',
        content: `Una campana es una ejecucion de un playbook con valores especificos. Cada campana tiene sus propias variables y documentos asociados.`,
      },
      {
        title: 'Playbooks disponibles',
        content: `Gattaca incluye playbooks pre-configurados:
- **Analisis de Competidores** - Triangulacion de percepcion
- **Niche Finder** - Descubrimiento de nichos
- **Video Viral IA** - Generacion de contenido viral
- **Signal-Based Outreach** - Prospeccion basada en senales`,
      },
      {
        title: 'Ejecucion de pasos',
        content: `Cada paso se ejecuta secuencialmente. El output de cada paso puede ser usado por los siguientes mediante \`{{ step:NombreDelPaso }}\`.

Puedes revisar, editar y re-ejecutar cualquier paso si el resultado no es satisfactorio.`,
      },
    ],
    relatedTopics: ['variables', 'documents', 'step-editor'],
  },

  'step-editor': {
    id: 'step-editor',
    title: 'Editor de Pasos',
    icon: '✏️',
    shortDescription: 'Configurar y ejecutar pasos',
    content: [
      {
        title: 'Componentes del paso',
        content: `Cada paso tiene:
- **Nombre**: Identificador del paso
- **Prompt**: El texto que se enviara al modelo
- **Modelo**: Que LLM usar (Gemini, GPT, Claude)
- **Documentos base**: Contexto adicional para el prompt`,
      },
      {
        title: 'Atajos de teclado',
        content: `- \`{{\` - Abrir autocompletado de variables
- \`↑↓\` - Navegar opciones
- \`Enter\` - Seleccionar variable
- \`Escape\` - Cerrar autocompletado
- \`Ctrl+S\` - Guardar cambios`,
      },
      {
        title: 'Validacion',
        content: `El panel de validacion te muestra:
- Variables no declaradas (necesitan agregarse al proyecto)
- Variables sin usar (declaradas pero no usadas)
- Errores de sintaxis (llaves mal formadas)
- Posibles errores de tipeo`,
      },
    ],
    relatedTopics: ['variables', 'campaigns'],
  },

  scrapers: {
    id: 'scrapers',
    title: 'Scrapers',
    icon: '🕷️',
    shortDescription: 'Extraccion automatica de datos',
    content: [
      {
        title: 'Tipos de scrapers',
        content: `**Redes Sociales**
- Instagram (posts, comentarios)
- TikTok (videos, comentarios)
- LinkedIn (posts, comentarios)
- Facebook (posts, comentarios)
- YouTube (videos, comentarios, transcripciones)

**Reviews**
- Trustpilot
- G2
- Capterra
- App Store / Play Store
- Google Maps

**Web & SEO**
- Website content (Firecrawl)
- SEO keywords
- SERP analysis`,
      },
      {
        title: 'Ejecucion',
        content: `Los scrapers se ejecutan en background. Puedes ver el progreso en tiempo real y los resultados se guardan automaticamente como documentos en tu proyecto.`,
      },
    ],
    relatedTopics: ['documents', 'campaigns'],
  },
}

// Quick tips for contextual display
export const QUICK_TIPS: Record<string, { title: string; description: string; topic?: string }> = {
  'variables-autocomplete': {
    title: 'Autocompletado',
    description: 'Escribe {{ para ver las variables disponibles',
    topic: 'variables',
  },
  'document-naming': {
    title: 'Nomenclatura',
    description: 'Usa el formato "Fuente - Objetivo - Fecha" para mejor organizacion',
    topic: 'documents',
  },
  'step-output': {
    title: 'Outputs de pasos',
    description: 'Usa {{ step:NombreDelPaso }} para incluir el resultado de pasos anteriores',
    topic: 'variables',
  },
  'first-campaign': {
    title: 'Tu primera campana',
    description: 'Selecciona un playbook y sigue el wizard para configurar tu primera campana',
    topic: 'campaigns',
  },
}

// Get all topics as array
export function getAllTopics(): HelpTopic[] {
  return Object.values(HELP_TOPICS)
}

// Get topic by ID
export function getTopic(id: string): HelpTopic | undefined {
  return HELP_TOPICS[id]
}

// Get quick tip by ID
export function getQuickTip(id: string) {
  return QUICK_TIPS[id]
}
