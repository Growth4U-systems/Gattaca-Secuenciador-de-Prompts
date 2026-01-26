/**
 * Signal-Based Outreach Playbook Configuration
 *
 * LinkedIn outreach usando señales de intención. Encuentra creadores
 * cuya audiencia coincide con tu ICP, scrapea engagers y genera
 * mensajes personalizados.
 *
 * Flow:
 * Fase 1: Discovery de Creadores
 *   1. Mapear Propuesta → Temas
 *   2. Buscar Creadores
 *   3. Evaluar Creadores
 *   4. Seleccionar Creadores
 *
 * Fase 2: Discovery de Posts
 *   5. Scrapear Posts
 *   6. Evaluar Posts
 *   7. Seleccionar Posts
 *
 * Fase 3: Leads + Outreach
 *   8. Scrapear Engagers
 *   9. Filtrar por ICP
 *   10. Lead Magnet + Mensajes
 *   11. Export y Lanzamiento
 */

import { PlaybookConfig, StepGuidance, PlaybookPresentation } from '../types'

/**
 * Step Guidance Configurations
 */
const STEP_GUIDANCE: Record<string, StepGuidance> = {
  map_topics: {
    description: 'Traduce tu propuesta de valor a temas de contenido que atraigan a tu ICP. La IA analizará tu producto y generará topics relevantes.',
    userActions: [
      'Asegúrate de haber completado la configuración del playbook',
      'Revisa que tu propuesta de valor esté clara y específica',
      'Ejecuta el análisis de topics',
      'Revisa los topics generados y ajusta si es necesario',
    ],
    completionCriteria: {
      description: 'Se deben generar al menos 5 topics relevantes',
      type: 'auto_complete',
    },
  },
  find_creators: {
    description: 'Genera una estrategia para encontrar creadores de LinkedIn relevantes basándose en los topics identificados.',
    userActions: [
      'Revisa los topics del paso anterior',
      'Ejecuta la búsqueda de creadores',
      'La IA sugerirá creadores basados en tu nicho',
      'Puedes agregar creadores que ya conoces manualmente',
    ],
    completionCriteria: {
      description: 'La búsqueda debe completarse con sugerencias de creadores',
      type: 'auto_complete',
    },
  },
  evaluate_creators: {
    description: 'Evalúa la actividad, viralidad y calidad de audiencia de cada creador sugerido para priorizar los mejores.',
    userActions: [
      'Revisa la lista de creadores encontrados',
      'Ejecuta la evaluación de cada creador',
      'La IA analizará métricas como frecuencia de posts, engagement promedio, etc.',
      'Revisa los scores asignados',
    ],
    completionCriteria: {
      description: 'Todos los creadores deben tener un score de evaluación',
      type: 'auto_complete',
    },
  },
  select_creators: {
    description: 'Selecciona los creadores con mejor score para la siguiente fase de scraping de posts.',
    userActions: [
      'Revisa los creadores evaluados ordenados por score',
      'Selecciona los creadores que deseas incluir (recomendado: 5-10)',
      'Verifica que los seleccionados tengan audiencias alineadas con tu ICP',
      'Confirma tu selección para continuar',
    ],
    completionCriteria: {
      description: 'Debes seleccionar al menos 3 creadores',
      type: 'selection_required',
      minCount: 3,
    },
  },
  scrape_posts: {
    description: 'Extrae los últimos posts de cada creador seleccionado junto con sus métricas de engagement.',
    userActions: [
      'Confirma los creadores seleccionados',
      'Ejecuta el scraping de posts (puede tomar varios minutos)',
      'Alternativamente, puedes importar un CSV con posts ya scrapeados',
      'Revisa que los posts se hayan extraído correctamente',
    ],
    completionCriteria: {
      description: 'El scraping debe completarse con al menos 20 posts',
      type: 'auto_complete',
    },
  },
  evaluate_posts: {
    description: 'Puntúa los posts extraídos por engagement, recencia y alineamiento con tu ICP.',
    userActions: [
      'Revisa los posts scrapeados',
      'Ejecuta la evaluación con IA',
      'La IA calculará un "fit score" basado en relevancia para tu ICP',
      'Revisa los posts mejor puntuados',
    ],
    completionCriteria: {
      description: 'Todos los posts deben tener un fit score',
      type: 'auto_complete',
    },
  },
  select_posts: {
    description: 'Selecciona los posts con mejor engagement y fit score para scrapear sus engagers (quienes comentaron/reaccionaron).',
    userActions: [
      'Revisa los posts ordenados por fit score',
      'Selecciona los posts de los que quieres extraer engagers (recomendado: 10-20)',
      'Prioriza posts con muchos comentarios de calidad',
      'Confirma tu selección',
    ],
    completionCriteria: {
      description: 'Debes seleccionar al menos 5 posts',
      type: 'selection_required',
      minCount: 5,
    },
  },
  scrape_engagers: {
    description: 'Extrae los perfiles de LinkedIn de quienes interactuaron (likes, comentarios) con los posts seleccionados.',
    userActions: [
      'Confirma los posts seleccionados',
      'Ejecuta el scraping de engagers (puede tomar varios minutos)',
      'Alternativamente, importa un CSV con engagers ya scrapeados',
      'El resultado serán perfiles de potenciales leads',
    ],
    completionCriteria: {
      description: 'El scraping debe completarse con al menos 50 perfiles',
      type: 'auto_complete',
    },
  },
  filter_icp: {
    description: 'Clasifica cada engager como ICP (ideal), Dudoso o Fuera de target usando IA.',
    userActions: [
      'Revisa los perfiles extraídos',
      'Ejecuta el filtrado por ICP',
      'La IA analizará título, empresa y bio de cada perfil',
      'Revisa la clasificación y ajusta manualmente si es necesario',
    ],
    completionCriteria: {
      description: 'Todos los perfiles deben estar clasificados',
      type: 'auto_complete',
    },
  },
  lead_magnet_messages: {
    description: 'Crea un lead magnet atractivo y genera mensajes de conexión/seguimiento personalizados para cada lead.',
    userActions: [
      'Define o confirma tu lead magnet (ebook, template, tool, etc.)',
      'Revisa el contexto del sender (nombre, título, empresa)',
      'Ejecuta la generación de mensajes',
      'Revisa y ajusta los mensajes generados',
    ],
    completionCriteria: {
      description: 'Cada lead ICP debe tener un mensaje personalizado',
      type: 'auto_complete',
    },
  },
  export_launch: {
    description: 'Exporta el CSV final con leads y mensajes para importar en tu herramienta de outreach y lanzar la campaña.',
    userActions: [
      'Revisa el resumen final de leads y mensajes',
      'Descarga el CSV con formato para tu herramienta (Lemlist, Expandi, etc.)',
      'Importa en tu herramienta de outreach',
      'Lanza la campaña y monitorea resultados',
    ],
    completionCriteria: {
      description: 'El CSV debe descargarse correctamente',
      type: 'manual',
    },
  },
}

/**
 * Presentation metadata for the intro screen
 */
const PRESENTATION: PlaybookPresentation = {
  tagline: 'LinkedIn outreach con señales de intención real para conversiones 10x',
  valueProposition: [
    'Leads que ya mostraron interés en temas relacionados con tu producto',
    'Mensajes personalizados basados en su actividad real en LinkedIn',
    'Pipeline de 500+ leads cualificados en una campaña',
    'Tasas de respuesta 3-5x superiores al outreach frío tradicional',
  ],
  exampleOutput: {
    type: 'data',
    preview: {
      text: '📊 Resultados típicos:\n• 523 leads extraídos de posts virales\n• 312 clasificados como ICP (60%)\n• Mensajes personalizados generados\n• CSV listo para Lemlist/Expandi',
    },
  },
  estimatedTime: '45-60 minutos',
  estimatedCost: '~$2-5 USD (scraping + IA)',
  requiredServices: [
    {
      key: 'openrouter',
      name: 'OpenRouter (IA)',
      description: 'Evalúa creadores, clasifica ICP y genera mensajes',
    },
    {
      key: 'apify',
      name: 'Apify (Scraping)',
      description: 'Extrae posts y engagers de LinkedIn',
    },
  ],
}

export const signalOutreachConfig: PlaybookConfig = {
  id: 'signal-outreach',
  type: 'signal-outreach',
  name: 'Signal-Based Outreach',
  description: 'LinkedIn outreach usando señales de intención. Encuentra creadores cuya audiencia coincide con tu ICP, scrapea engagers y genera mensajes personalizados.',
  icon: '📡',
  presentation: PRESENTATION,

  phases: [
    {
      id: 'discovery-creators',
      name: 'Fase 1: Discovery de Creadores',
      description: 'Identificar creadores cuya audiencia coincide con tu ICP',
      steps: [
        {
          id: 'map_topics',
          name: 'Mapear Propuesta → Temas',
          description: 'Traduce tu propuesta de valor a temas de contenido que atraigan al ICP',
          type: 'auto',
          executor: 'llm',
          guidance: STEP_GUIDANCE.map_topics,
          dependsOn: [],
          executionExplanation: {
            title: 'Análisis de Topics',
            steps: [
              'Analiza tu propuesta de valor y ICP',
              'Identifica palabras clave y conceptos principales',
              'Genera 5-10 topics de contenido relevantes',
              'Sugiere hashtags y términos de búsqueda',
            ],
            estimatedTime: '15-30 segundos',
            estimatedCost: '~$0.02',
            costService: 'OpenRouter',
          },
        },
        {
          id: 'find_creators',
          name: 'Buscar Creadores',
          description: 'Genera estrategia para encontrar creadores relevantes en LinkedIn',
          type: 'auto',
          executor: 'llm',
          guidance: STEP_GUIDANCE.find_creators,
          dependsOn: ['map_topics'],
          executionExplanation: {
            title: 'Búsqueda de Creadores',
            steps: [
              'Usa los topics para generar criterios de búsqueda',
              'Sugiere creadores conocidos en el nicho',
              'Proporciona estrategias para encontrar más',
              'Genera lista inicial de perfiles a evaluar',
            ],
            estimatedTime: '20-40 segundos',
            estimatedCost: '~$0.03',
            costService: 'OpenRouter',
          },
        },
        {
          id: 'evaluate_creators',
          name: 'Evaluar Creadores',
          description: 'Evalúa actividad, viralidad y calidad de audiencia de cada creador',
          type: 'auto',
          executor: 'api',
          guidance: STEP_GUIDANCE.evaluate_creators,
          dependsOn: ['find_creators'],
          requiredApiKeys: ['apify'],
          executionExplanation: {
            title: 'Evaluación de Creadores',
            steps: [
              'Scrapea métricas de cada perfil de creador',
              'Analiza frecuencia de publicación',
              'Calcula engagement promedio',
              'Evalúa alineamiento de audiencia con ICP',
              'Asigna score de relevancia',
            ],
            estimatedTime: '2-5 minutos',
            estimatedCost: '~$0.50',
            costService: 'Apify + OpenRouter',
          },
        },
        {
          id: 'select_creators',
          name: 'Seleccionar Creadores',
          description: 'Prioriza los mejores creadores para scrapear',
          type: 'manual_review',
          executor: 'none',
          guidance: STEP_GUIDANCE.select_creators,
          dependsOn: ['evaluate_creators'],
          executionExplanation: {
            title: 'Selección Manual',
            steps: [
              'Muestra creadores ordenados por score',
              'Permite selección múltiple',
              'Recomienda cantidad óptima (5-10)',
              'Confirma selección para siguiente fase',
            ],
            estimatedTime: '2-5 minutos (manual)',
            estimatedCost: 'Sin costo',
            costService: 'Ninguno',
          },
        },
      ],
    },
    {
      id: 'discovery-posts',
      name: 'Fase 2: Discovery de Posts',
      description: 'Encontrar posts virales con alto engagement del ICP',
      steps: [
        {
          id: 'scrape_posts',
          name: 'Scrapear Posts',
          description: 'Extrae los últimos posts de cada creador con sus métricas',
          type: 'auto',
          executor: 'api',
          guidance: STEP_GUIDANCE.scrape_posts,
          dependsOn: ['select_creators'],
          requiredApiKeys: ['apify'],
          executionExplanation: {
            title: 'Scraping de Posts',
            steps: [
              'Conecta con Apify para scraping de LinkedIn',
              'Extrae últimos 20-50 posts de cada creador',
              'Obtiene métricas: likes, comentarios, shares',
              'Estructura datos para evaluación',
            ],
            estimatedTime: '5-10 minutos',
            estimatedCost: '~$0.50-1.00',
            costService: 'Apify',
          },
        },
        {
          id: 'evaluate_posts',
          name: 'Evaluar Posts',
          description: 'Puntúa posts por engagement, recencia y alineamiento con ICP',
          type: 'auto',
          executor: 'llm',
          guidance: STEP_GUIDANCE.evaluate_posts,
          dependsOn: ['scrape_posts'],
          executionExplanation: {
            title: 'Evaluación con IA',
            steps: [
              'Analiza contenido de cada post',
              'Evalúa relevancia para tu ICP',
              'Calcula "fit score" combinando engagement + relevancia',
              'Ordena por potencial de leads cualificados',
            ],
            estimatedTime: '30-60 segundos',
            estimatedCost: '~$0.05',
            costService: 'OpenRouter',
          },
        },
        {
          id: 'select_posts',
          name: 'Seleccionar Posts',
          description: 'Elige los mejores posts para scrapear engagers',
          type: 'manual_review',
          executor: 'none',
          guidance: STEP_GUIDANCE.select_posts,
          dependsOn: ['evaluate_posts'],
          executionExplanation: {
            title: 'Selección Manual',
            steps: [
              'Muestra posts ordenados por fit score',
              'Incluye preview del contenido',
              'Permite selección múltiple',
              'Recomienda 10-20 posts para scraping',
            ],
            estimatedTime: '3-5 minutos (manual)',
            estimatedCost: 'Sin costo',
            costService: 'Ninguno',
          },
        },
      ],
    },
    {
      id: 'leads-outreach',
      name: 'Fase 3: Leads + Outreach',
      description: 'Scrapear engagers, filtrar por ICP y generar mensajes',
      steps: [
        {
          id: 'scrape_engagers',
          name: 'Scrapear Engagers',
          description: 'Extrae perfiles de quienes interactuaron con los posts',
          type: 'auto',
          executor: 'api',
          guidance: STEP_GUIDANCE.scrape_engagers,
          dependsOn: ['select_posts'],
          requiredApiKeys: ['apify'],
          executionExplanation: {
            title: 'Scraping de Engagers',
            steps: [
              'Extrae lista de likes y comentarios de cada post',
              'Obtiene perfil de LinkedIn de cada engager',
              'Incluye título, empresa, ubicación, bio',
              'Deduplica perfiles que aparecen múltiples veces',
            ],
            estimatedTime: '10-20 minutos',
            estimatedCost: '~$1-2',
            costService: 'Apify',
          },
        },
        {
          id: 'filter_icp',
          name: 'Filtrar por ICP',
          description: 'Clasifica leads en ICP / Dudoso / Fuera',
          type: 'auto_with_review',
          executor: 'llm',
          guidance: STEP_GUIDANCE.filter_icp,
          dependsOn: ['scrape_engagers'],
          executionExplanation: {
            title: 'Clasificación con IA',
            steps: [
              'Analiza título, empresa y bio de cada perfil',
              'Compara con tu definición de ICP',
              'Clasifica como: ICP, Dudoso o Fuera',
              'Permite ajuste manual de clasificaciones',
            ],
            estimatedTime: '1-2 minutos',
            estimatedCost: '~$0.10',
            costService: 'OpenRouter',
          },
        },
        {
          id: 'lead_magnet_messages',
          name: 'Lead Magnet + Mensajes',
          description: 'Crea lead magnet y mensajes personalizados',
          type: 'auto_with_review',
          executor: 'llm',
          guidance: STEP_GUIDANCE.lead_magnet_messages,
          dependsOn: ['filter_icp'],
          executionExplanation: {
            title: 'Generación de Mensajes',
            steps: [
              'Analiza el post donde interactuó cada lead',
              'Referencia su comentario o interacción',
              'Menciona tu lead magnet de forma natural',
              'Genera mensaje de conexión + follow-up',
            ],
            estimatedTime: '2-5 minutos',
            estimatedCost: '~$0.20',
            costService: 'OpenRouter',
          },
        },
        {
          id: 'export_launch',
          name: 'Export y Lanzamiento',
          description: 'Exporta CSV final y lanza la campaña',
          type: 'display',
          executor: 'none',
          guidance: STEP_GUIDANCE.export_launch,
          dependsOn: ['lead_magnet_messages'],
          executionExplanation: {
            title: 'Exportación Final',
            steps: [
              'Genera CSV con formato para herramientas de outreach',
              'Incluye: nombre, URL, empresa, mensaje, follow-up',
              'Proporciona instrucciones de importación',
              'Muestra métricas finales de la campaña',
            ],
            estimatedTime: 'Instantáneo',
            estimatedCost: 'Sin costo',
            costService: 'Ninguno',
          },
        },
      ],
    },
  ],

  variables: [
    {
      key: 'clientName',
      label: 'Nombre del Cliente',
      type: 'text',
      required: true,
      placeholder: 'Ej: Growth4U',
      description: 'Nombre de tu empresa o proyecto',
    },
    {
      key: 'valueProposition',
      label: 'Propuesta de Valor',
      type: 'textarea',
      required: true,
      placeholder: 'Qué problema resuelve tu producto y para quién',
      description: 'Descripción clara de tu producto/servicio y el problema que resuelve',
    },
    {
      key: 'icpDescription',
      label: 'Descripción del ICP',
      type: 'textarea',
      required: true,
      placeholder: 'Ej: CMOs de empresas SaaS B2B con 50-200 empleados en Latam',
      description: 'Perfil ideal de cliente: cargo, empresa, industria, ubicación',
    },
    {
      key: 'industry',
      label: 'Industria',
      type: 'text',
      required: false,
      placeholder: 'Ej: SaaS, Marketing, Fintech',
      description: 'Industria principal de tu target',
    },
    {
      key: 'country',
      label: 'País/Región',
      type: 'text',
      required: false,
      defaultValue: 'España',
      placeholder: 'Ej: España, Latam, USA',
      description: 'Ubicación geográfica del target',
    },
    {
      key: 'knownCreators',
      label: 'Creadores Conocidos',
      type: 'textarea',
      required: false,
      placeholder: 'URLs de LinkedIn de creadores que ya conoces (uno por línea)',
      description: 'Si ya conoces creadores relevantes, agrégalos aquí',
    },
    {
      key: 'targetLeadsCount',
      label: 'Meta de Leads',
      type: 'number',
      required: false,
      defaultValue: '500',
      description: 'Cantidad de leads que deseas obtener',
    },
    {
      key: 'leadMagnetUrl',
      label: 'URL del Lead Magnet',
      type: 'text',
      required: false,
      placeholder: 'https://...',
      description: 'URL de tu lead magnet (ebook, template, tool)',
    },
    {
      key: 'leadMagnetDescription',
      label: 'Descripción del Lead Magnet',
      type: 'textarea',
      required: false,
      placeholder: 'Qué es y qué valor aporta al ICP',
      description: 'Breve descripción del lead magnet para los mensajes',
    },
    {
      key: 'senderName',
      label: 'Nombre del Sender',
      type: 'text',
      required: false,
      placeholder: 'Tu nombre',
      description: 'Nombre de quien enviará los mensajes',
    },
    {
      key: 'senderTitle',
      label: 'Título del Sender',
      type: 'text',
      required: false,
      placeholder: 'Ej: Founder, Head of Growth',
      description: 'Cargo/título para los mensajes',
    },
    {
      key: 'senderCompany',
      label: 'Empresa del Sender',
      type: 'text',
      required: false,
      placeholder: 'Nombre de tu empresa',
      description: 'Empresa para firmar los mensajes',
    },
  ],
}

export default signalOutreachConfig
