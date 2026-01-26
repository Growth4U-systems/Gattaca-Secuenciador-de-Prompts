/**
 * UX Enhancer for n8n to Gattaca Conversion
 *
 * Generates rich UX metadata for better user experience:
 * - StepGuidance: instructions, user actions, completion criteria
 * - ExecutionExplanation: what the step does, costs, services
 * - Variable metadata: placeholders, help text, examples
 * - Phase descriptions: user-friendly phase names and descriptions
 */

import { StepGuidance, StepCompletionCriteria, StepType, ExecutorType } from '@/components/playbook/types'
import { N8nNode } from '../types'

// ============================================
// Step Guidance Generation
// ============================================

export interface GuidanceContext {
  nodeType: string
  nodeName: string
  stepType: StepType
  executorType: ExecutorType
  parameters: Record<string, unknown>
  dependencies: string[]
  isFirstStep: boolean
  isLastStep: boolean
}

/**
 * Generate comprehensive StepGuidance for a converted step
 */
export function generateStepGuidance(context: GuidanceContext): StepGuidance {
  const { nodeType, stepType, executorType, parameters, isFirstStep, isLastStep } = context

  // Get guidance template based on node type
  const template = getGuidanceTemplate(nodeType, stepType, executorType)

  // Customize guidance based on parameters
  const customizedGuidance = customizeGuidance(template, context)

  return customizedGuidance
}

/**
 * Get base guidance template for node type
 */
function getGuidanceTemplate(
  nodeType: string,
  stepType: StepType,
  executorType: ExecutorType
): StepGuidance {
  const nodeTypeLower = nodeType.toLowerCase()

  // Trigger nodes
  if (nodeTypeLower.includes('trigger') || nodeTypeLower.includes('webhook')) {
    return {
      description: 'Este paso inicia el playbook. Ingrese los datos iniciales necesarios para comenzar.',
      userActions: [
        'Revise la configuración inicial del playbook',
        'Ingrese cualquier dato requerido para comenzar',
        'Haga clic en "Continuar" cuando esté listo',
      ],
      completionCriteria: {
        description: 'Ingrese los datos iniciales para comenzar',
        type: 'input_required',
        minCount: 1,
      },
    }
  }

  // HTTP Request nodes
  if (nodeTypeLower.includes('httprequest') || nodeTypeLower.includes('http')) {
    return {
      description: 'Este paso realiza una llamada a una API externa para obtener o enviar datos.',
      userActions: [
        'Revise que la configuración de la API sea correcta',
        'Asegúrese de tener las credenciales necesarias configuradas',
        'Ejecute el paso cuando esté listo',
        'Revise los resultados antes de continuar',
      ],
      completionCriteria: {
        description: 'La llamada API debe completarse exitosamente',
        type: 'auto_complete',
      },
    }
  }

  // OpenAI / LLM nodes
  if (nodeTypeLower.includes('openai') || nodeTypeLower.includes('llm') || nodeTypeLower.includes('chat')) {
    return {
      description: 'Este paso utiliza inteligencia artificial para procesar y generar contenido.',
      userActions: [
        'Revise la configuración del prompt si está disponible',
        'Ejecute el procesamiento de IA',
        'Revise el contenido generado',
        'Edite si es necesario antes de continuar',
      ],
      completionCriteria: {
        description: 'El procesamiento de IA debe completarse y el resultado debe ser revisado',
        type: 'auto_complete',
      },
    }
  }

  // Anthropic / Claude nodes
  if (nodeTypeLower.includes('anthropic') || nodeTypeLower.includes('claude')) {
    return {
      description: 'Este paso utiliza Claude AI (Anthropic) para análisis y generación de contenido.',
      userActions: [
        'Revise la configuración del modelo y prompt',
        'Ejecute el análisis de IA',
        'Revise el resultado generado',
        'Modifique si es necesario antes de continuar',
      ],
      completionCriteria: {
        description: 'El análisis de IA debe completarse exitosamente',
        type: 'auto_complete',
      },
    }
  }

  // Agent nodes
  if (nodeTypeLower.includes('agent')) {
    return {
      description: 'Este paso ejecuta un agente de IA con capacidad de usar herramientas para resolver tareas complejas.',
      userActions: [
        'Revise la configuración del agente',
        'Inicie la ejecución del agente',
        'Observe el progreso mientras el agente trabaja',
        'Revise los resultados finales del agente',
      ],
      completionCriteria: {
        description: 'El agente debe completar su tarea exitosamente',
        type: 'auto_complete',
      },
    }
  }

  // Transform / Code nodes
  if (nodeTypeLower.includes('set') || nodeTypeLower.includes('code') || nodeTypeLower.includes('transform')) {
    return {
      description: 'Este paso transforma los datos para prepararlos para el siguiente paso.',
      userActions: [
        'El procesamiento se ejecuta automáticamente',
        'Revise los datos transformados si es necesario',
      ],
      completionCriteria: {
        description: 'La transformación debe completarse sin errores',
        type: 'auto_complete',
      },
    }
  }

  // If/Switch nodes
  if (nodeTypeLower.includes('if') || nodeTypeLower.includes('switch')) {
    return {
      description: 'Este paso evalúa condiciones y determina el siguiente camino a seguir.',
      userActions: [
        'El sistema evaluará las condiciones automáticamente',
        'Revise qué camino se seleccionó',
        'Continue al siguiente paso según la decisión',
      ],
      completionCriteria: {
        description: 'La evaluación debe completarse para determinar el siguiente paso',
        type: 'auto_complete',
      },
    }
  }

  // Email nodes
  if (nodeTypeLower.includes('email') || nodeTypeLower.includes('gmail') || nodeTypeLower.includes('mail')) {
    return {
      description: 'Este paso envía o procesa emails según la configuración.',
      userActions: [
        'Revise el contenido del email antes de enviar',
        'Asegúrese de que los destinatarios sean correctos',
        'Ejecute cuando esté listo',
      ],
      completionCriteria: {
        description: 'El email debe enviarse exitosamente',
        type: 'auto_complete',
      },
    }
  }

  // Slack nodes
  if (nodeTypeLower.includes('slack')) {
    return {
      description: 'Este paso envía o recibe mensajes de Slack.',
      userActions: [
        'Revise el mensaje antes de enviar',
        'Asegúrese de que el canal sea correcto',
        'Ejecute cuando esté listo',
      ],
      completionCriteria: {
        description: 'El mensaje debe enviarse exitosamente',
        type: 'auto_complete',
      },
    }
  }

  // Database nodes
  if (nodeTypeLower.includes('postgres') || nodeTypeLower.includes('mysql') || nodeTypeLower.includes('mongo') || nodeTypeLower.includes('database')) {
    return {
      description: 'Este paso interactúa con la base de datos para leer o escribir información.',
      userActions: [
        'Revise la consulta o datos a insertar',
        'Ejecute la operación de base de datos',
        'Revise los resultados de la operación',
      ],
      completionCriteria: {
        description: 'La operación de base de datos debe completarse sin errores',
        type: 'auto_complete',
      },
    }
  }

  // File nodes
  if (nodeTypeLower.includes('file') || nodeTypeLower.includes('spreadsheet') || nodeTypeLower.includes('csv')) {
    return {
      description: 'Este paso procesa archivos (lectura, escritura o transformación).',
      userActions: [
        'Revise la configuración del archivo',
        'Ejecute el procesamiento',
        'Verifique que el archivo se procesó correctamente',
      ],
      completionCriteria: {
        description: 'El archivo debe procesarse exitosamente',
        type: 'auto_complete',
      },
    }
  }

  // Default guidance based on step type
  return getDefaultGuidanceByStepType(stepType, executorType)
}

/**
 * Get default guidance based on step type when node type is unknown
 */
function getDefaultGuidanceByStepType(stepType: StepType, executorType: ExecutorType): StepGuidance {
  switch (stepType) {
    case 'input':
      return {
        description: 'Ingrese la información necesaria para este paso.',
        userActions: [
          'Complete los campos requeridos',
          'Revise la información ingresada',
          'Haga clic en "Continuar" cuando esté listo',
        ],
        completionCriteria: {
          description: 'Complete todos los campos requeridos',
          type: 'input_required',
        },
      }

    case 'auto':
      return {
        description: 'Este paso se ejecuta automáticamente.',
        userActions: [
          'Revise la configuración si es necesario',
          'Ejecute el paso',
          'Espere a que complete',
        ],
        completionCriteria: {
          description: 'El paso debe completarse exitosamente',
          type: 'auto_complete',
        },
      }

    case 'auto_with_review':
      return {
        description: 'Este paso se ejecuta automáticamente y muestra el resultado para su revisión.',
        userActions: [
          'Ejecute el paso automático',
          'Revise el resultado generado',
          'Edite si es necesario',
          'Continue cuando esté satisfecho con el resultado',
        ],
        completionCriteria: {
          description: 'Revise y apruebe el resultado antes de continuar',
          type: 'manual',
        },
      }

    case 'decision':
      return {
        description: 'Seleccione una opción para continuar.',
        userActions: [
          'Revise las opciones disponibles',
          'Seleccione la opción deseada',
          'Continue con su selección',
        ],
        completionCriteria: {
          description: 'Seleccione al menos una opción',
          type: 'selection_required',
          minCount: 1,
        },
      }

    case 'display':
      return {
        description: 'Este paso muestra información para su revisión.',
        userActions: [
          'Revise la información mostrada',
          'Continue cuando haya terminado de revisar',
        ],
        completionCriteria: {
          description: 'Continue cuando haya revisado la información',
          type: 'manual',
        },
      }

    case 'action':
      return {
        description: 'Realice la acción indicada.',
        userActions: [
          'Ejecute la acción cuando esté listo',
        ],
        completionCriteria: {
          description: 'Complete la acción para continuar',
          type: 'manual',
        },
      }

    default:
      return {
        description: 'Complete este paso para continuar.',
        userActions: [
          'Siga las instrucciones del paso',
          'Continue cuando termine',
        ],
        completionCriteria: {
          description: 'Complete el paso para continuar',
          type: 'manual',
        },
      }
  }
}

/**
 * Customize guidance based on specific node parameters
 */
function customizeGuidance(
  baseGuidance: StepGuidance,
  context: GuidanceContext
): StepGuidance {
  const { parameters, nodeName, dependencies, isFirstStep, isLastStep } = context
  const guidance = { ...baseGuidance }

  // Customize description with node name
  if (nodeName) {
    guidance.description = `${guidance.description.replace('.', '')} (${nodeName}).`
  }

  // Add dependency info to user actions
  if (dependencies.length > 0) {
    guidance.userActions = [
      `Este paso usa datos de: ${dependencies.join(', ')}`,
      ...guidance.userActions,
    ]
  }

  // Add first step specific guidance
  if (isFirstStep) {
    guidance.userActions = [
      '**Primer paso del playbook**',
      ...guidance.userActions,
    ]
  }

  // Add last step specific guidance
  if (isLastStep) {
    guidance.userActions = [
      ...guidance.userActions,
      'Este es el último paso - revise todos los resultados antes de finalizar',
    ]
    guidance.completionCriteria = {
      description: 'Revise todos los resultados y confirme para completar el playbook',
      type: 'manual',
    }
  }

  // Customize based on specific parameters
  if (parameters.url && typeof parameters.url === 'string') {
    const url = parameters.url.substring(0, 50)
    guidance.description = `${guidance.description} Conecta con: ${url}...`
  }

  if (parameters.model && typeof parameters.model === 'string') {
    guidance.description = `${guidance.description} Usa el modelo: ${parameters.model}`
  }

  return guidance
}

// ============================================
// Execution Explanation Enhancement
// ============================================

export interface ExecutionExplanation {
  title: string
  steps: string[]
  estimatedTime?: string
  estimatedCost?: string
  costService?: string
}

/**
 * Generate detailed execution explanation based on node type
 */
export function generateExecutionExplanation(
  nodeType: string,
  nodeName: string,
  parameters: Record<string, unknown>
): ExecutionExplanation {
  const nodeTypeLower = nodeType.toLowerCase()

  // HTTP Request
  if (nodeTypeLower.includes('httprequest') || nodeTypeLower.includes('http')) {
    const method = (parameters.method as string) || 'GET'
    const url = parameters.url as string || ''
    const urlPreview = url ? url.substring(0, 40) : 'URL configurada'

    return {
      title: `Llamada API (${method})`,
      steps: [
        `Prepara la solicitud ${method} a ${urlPreview}...`,
        'Agrega headers de autenticación si están configurados',
        'Envía la solicitud al servidor externo',
        'Recibe y procesa la respuesta',
        'Formatea los datos para el siguiente paso',
      ],
      estimatedTime: '5-30 segundos',
      estimatedCost: 'Puede tener costos de API externa',
      costService: 'API Externa',
    }
  }

  // OpenAI
  if (nodeTypeLower.includes('openai') || nodeTypeLower.includes('lmchatopenai')) {
    const model = (parameters.model as string) || 'gpt-4'
    const operation = (parameters.operation as string) || 'chat'

    return {
      title: `Procesamiento IA (${model})`,
      steps: [
        'Prepara el prompt con los datos de entrada',
        parameters.systemMessage ? 'Aplica el prompt de sistema configurado' : 'Usa comportamiento por defecto',
        `Envía solicitud a OpenAI (${model})`,
        'Recibe respuesta de la IA',
        'Procesa y estructura el resultado',
      ],
      estimatedTime: '10-60 segundos',
      estimatedCost: 'Costo por tokens de OpenAI API',
      costService: 'OpenAI',
    }
  }

  // Anthropic
  if (nodeTypeLower.includes('anthropic') || nodeTypeLower.includes('claude')) {
    const model = (parameters.model as string) || 'claude-3-sonnet'

    return {
      title: `Análisis Claude AI (${model})`,
      steps: [
        'Prepara el contexto y prompt',
        'Envía solicitud a Anthropic Claude',
        `Procesa con ${model}`,
        'Recibe análisis completo',
        'Formatea resultado para siguiente paso',
      ],
      estimatedTime: '10-60 segundos',
      estimatedCost: 'Costo por tokens de Anthropic API',
      costService: 'Anthropic',
    }
  }

  // Agent
  if (nodeTypeLower.includes('agent')) {
    return {
      title: 'Agente IA con Herramientas',
      steps: [
        'Inicializa el agente con las herramientas configuradas',
        'Analiza la tarea y planifica la ejecución',
        'Ejecuta las herramientas necesarias iterativamente',
        'Consolida resultados de todas las herramientas',
        'Genera respuesta final',
      ],
      estimatedTime: '30 segundos - 5 minutos',
      estimatedCost: 'Variable según herramientas y iteraciones',
      costService: 'LLM API + Herramientas',
    }
  }

  // Code/Transform
  if (nodeTypeLower.includes('set') || nodeTypeLower.includes('code') || nodeTypeLower.includes('transform')) {
    return {
      title: 'Transformación de Datos',
      steps: [
        'Lee los datos del paso anterior',
        'Aplica las transformaciones configuradas',
        'Valida el formato de salida',
        'Pasa datos al siguiente paso',
      ],
      estimatedTime: '1-5 segundos',
      estimatedCost: 'Sin costo adicional',
      costService: 'Procesamiento local',
    }
  }

  // If/Switch
  if (nodeTypeLower.includes('if') || nodeTypeLower.includes('switch')) {
    return {
      title: 'Evaluación Condicional',
      steps: [
        'Evalúa las condiciones configuradas',
        'Determina qué camino seguir',
        'Redirige al paso correspondiente',
      ],
      estimatedTime: '< 1 segundo',
      estimatedCost: 'Sin costo adicional',
      costService: 'Procesamiento local',
    }
  }

  // Default
  return {
    title: `Ejecutando: ${nodeName}`,
    steps: [
      'Prepara los datos de entrada',
      'Ejecuta la operación configurada',
      'Procesa el resultado',
      'Prepara datos para el siguiente paso',
    ],
    estimatedTime: 'Variable',
    estimatedCost: 'Depende del servicio',
  }
}

// ============================================
// Variable Enhancement
// ============================================

export interface EnhancedVariable {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number'
  required?: boolean
  defaultValue?: unknown
  description?: string
  placeholder?: string
  helpText?: string
  examples?: string[]
  options?: Array<{ value: string; label: string }>
  min?: number
  max?: number
}

/**
 * Enhance a variable with better UX metadata
 */
export function enhanceVariable(
  key: string,
  label: string,
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number',
  context: {
    nodeType?: string
    nodeName?: string
    isInput?: boolean
    isAI?: boolean
  }
): EnhancedVariable {
  const variable: EnhancedVariable = {
    key,
    label,
    type,
    required: true,
  }

  // Enhance based on common patterns
  const keyLower = key.toLowerCase()

  // Topic/Subject variables
  if (keyLower.includes('topic') || keyLower.includes('subject') || keyLower.includes('tema')) {
    variable.description = 'El tema principal sobre el que trabajará el playbook'
    variable.placeholder = 'Ej: Marketing con IA, Productividad remota, Tendencias de diseño'
    variable.helpText = 'Sea específico pero no demasiado restrictivo (3-5 palabras recomendado)'
    variable.examples = ['AI in Marketing', 'Remote Work Productivity', 'Sustainable Business']
  }

  // Prompt variables
  if (keyLower.includes('prompt')) {
    variable.type = 'textarea'
    variable.description = 'Prompt personalizado para el procesamiento de IA'
    variable.placeholder = 'Escriba instrucciones específicas para la IA...'
    variable.helpText = 'Sea claro y específico en sus instrucciones'
  }

  // Tone/Style variables
  if (keyLower.includes('tone') || keyLower.includes('style') || keyLower.includes('tono') || keyLower.includes('estilo')) {
    variable.type = 'select'
    variable.description = 'El tono o estilo del contenido generado'
    variable.options = [
      { value: 'professional', label: 'Profesional' },
      { value: 'conversational', label: 'Conversacional' },
      { value: 'casual', label: 'Casual' },
      { value: 'formal', label: 'Formal' },
      { value: 'inspirational', label: 'Inspiracional' },
    ]
    variable.defaultValue = 'professional'
  }

  // Audience variables
  if (keyLower.includes('audience') || keyLower.includes('target') || keyLower.includes('audiencia')) {
    variable.description = 'La audiencia objetivo para el contenido'
    variable.placeholder = 'Ej: Profesionales de marketing, Emprendedores, Desarrolladores'
    variable.helpText = 'Defina claramente quién consumirá este contenido'
    variable.examples = ['Marketing professionals', 'Startup founders', 'Software developers']
  }

  // URL variables
  if (keyLower.includes('url') || keyLower.includes('link') || keyLower.includes('endpoint')) {
    variable.description = 'URL o endpoint para la conexión'
    variable.placeholder = 'https://api.example.com/endpoint'
    variable.helpText = 'Asegúrese de incluir el protocolo (https://)'
  }

  // Count/Number variables
  if (keyLower.includes('count') || keyLower.includes('number') || keyLower.includes('cantidad') || keyLower.includes('max') || keyLower.includes('limit')) {
    variable.type = 'number'
    variable.min = 1
    variable.max = 100
    variable.defaultValue = 10
    variable.description = 'Cantidad de elementos a procesar'
  }

  // Language variables
  if (keyLower.includes('language') || keyLower.includes('idioma') || keyLower.includes('lang')) {
    variable.type = 'select'
    variable.description = 'Idioma del contenido'
    variable.options = [
      { value: 'es', label: 'Español' },
      { value: 'en', label: 'English' },
      { value: 'pt', label: 'Português' },
      { value: 'fr', label: 'Français' },
      { value: 'de', label: 'Deutsch' },
    ]
    variable.defaultValue = 'es'
  }

  // Content/Text variables
  if (keyLower.includes('content') || keyLower.includes('text') || keyLower.includes('contenido') || keyLower.includes('texto')) {
    variable.type = 'textarea'
    variable.description = 'Contenido de texto para procesar'
    variable.placeholder = 'Ingrese el contenido aquí...'
  }

  return variable
}

// ============================================
// Phase Enhancement
// ============================================

export interface EnhancedPhaseInfo {
  name: string
  description: string
  icon?: string
}

/**
 * Generate user-friendly phase name and description
 */
export function enhancePhaseInfo(
  phaseId: string,
  steps: Array<{ name: string; type: StepType; executorType: ExecutorType }>
): EnhancedPhaseInfo {
  const phaseIdLower = phaseId.toLowerCase()

  // Input/Trigger phase
  if (phaseIdLower.includes('input') || phaseIdLower.includes('trigger') || phaseIdLower.includes('start')) {
    return {
      name: 'Configuración Inicial',
      description: 'Configure los parámetros iniciales y datos de entrada para comenzar el playbook',
      icon: '⚙️',
    }
  }

  // Processing phase
  if (phaseIdLower.includes('processing') || phaseIdLower.includes('process')) {
    const hasAI = steps.some(s => s.executorType === 'llm')
    const hasAPI = steps.some(s => s.executorType === 'api')

    if (hasAI && hasAPI) {
      return {
        name: 'Procesamiento y Análisis',
        description: 'Búsqueda de información y análisis con inteligencia artificial',
        icon: '🔍',
      }
    } else if (hasAI) {
      return {
        name: 'Análisis con IA',
        description: 'Procesamiento inteligente de los datos usando modelos de IA',
        icon: '🤖',
      }
    } else if (hasAPI) {
      return {
        name: 'Obtención de Datos',
        description: 'Conexión con servicios externos para obtener información',
        icon: '🌐',
      }
    }

    return {
      name: 'Procesamiento',
      description: 'Transformación y procesamiento de los datos',
      icon: '⚡',
    }
  }

  // Decision phase
  if (phaseIdLower.includes('decision') || phaseIdLower.includes('branch')) {
    return {
      name: 'Decisiones',
      description: 'Evaluación de condiciones y selección de caminos',
      icon: '🔀',
    }
  }

  // Output/Final phase
  if (phaseIdLower.includes('output') || phaseIdLower.includes('final') || phaseIdLower.includes('result')) {
    return {
      name: 'Resultados',
      description: 'Revisión y exportación de los resultados finales',
      icon: '📊',
    }
  }

  // Review phase
  if (phaseIdLower.includes('review')) {
    return {
      name: 'Revisión',
      description: 'Revise y apruebe los resultados antes de continuar',
      icon: '✅',
    }
  }

  // Generate phase
  if (phaseIdLower.includes('generate') || phaseIdLower.includes('create')) {
    return {
      name: 'Generación',
      description: 'Creación de contenido usando IA',
      icon: '✨',
    }
  }

  // Default
  return {
    name: capitalizeFirst(phaseId.replace(/[-_]/g, ' ')),
    description: `Fase de ${phaseId.replace(/[-_]/g, ' ')}`,
  }
}

// ============================================
// Utilities
// ============================================

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Determine step type based on node type and position
 */
export function determineStepType(
  nodeType: string,
  executorType: ExecutorType,
  isFirstStep: boolean
): StepType {
  const nodeTypeLower = nodeType.toLowerCase()

  // Triggers become input
  if (nodeTypeLower.includes('trigger') || nodeTypeLower.includes('webhook') || isFirstStep) {
    return 'input'
  }

  // LLM nodes become auto_with_review
  if (executorType === 'llm' || nodeTypeLower.includes('openai') || nodeTypeLower.includes('anthropic') || nodeTypeLower.includes('llm')) {
    return 'auto_with_review'
  }

  // Conditionals become decision
  if (nodeTypeLower.includes('if') || nodeTypeLower.includes('switch')) {
    return 'decision'
  }

  // Everything else is auto
  return 'auto'
}

// GuidanceContext is already exported with interface declaration above

// ============================================
// Playbook Presentation Generation
// ============================================

import { PlaybookPresentation, PreviewOutputType } from '@/components/playbook/types'

export interface PresentationContext {
  workflowName: string
  workflowDescription?: string
  nodes: Array<{
    type: string
    name: string
    parameters?: Record<string, unknown>
  }>
  stepCount: number
  hasAI: boolean
  hasImageGeneration: boolean
  hasWebScraping: boolean
  hasDataExtraction: boolean
}

/**
 * Generate PlaybookPresentation from workflow analysis
 * Creates user-friendly intro screen metadata
 */
export function generatePlaybookPresentation(context: PresentationContext): PlaybookPresentation {
  const { workflowName, workflowDescription, nodes, stepCount, hasAI, hasImageGeneration, hasWebScraping, hasDataExtraction } = context

  // Detect output type based on workflow characteristics
  const outputType = detectOutputType(context)

  // Generate tagline based on workflow purpose
  const tagline = generateTagline(workflowName, workflowDescription, context)

  // Generate value proposition (what user gets)
  const valueProposition = generateValueProposition(context)

  // Calculate estimated time
  const estimatedTime = calculateEstimatedTime(stepCount, hasAI, hasImageGeneration, hasWebScraping)

  // Calculate estimated cost
  const estimatedCost = calculateEstimatedCost(context)

  // Detect required services
  const requiredServices = detectRequiredServices(nodes)

  return {
    tagline,
    valueProposition,
    exampleOutput: {
      type: outputType,
      preview: {
        text: generateExamplePreview(context, outputType),
      },
    },
    estimatedTime,
    estimatedCost,
    requiredServices,
  }
}

/**
 * Detect the output type based on workflow characteristics
 */
function detectOutputType(context: PresentationContext): PreviewOutputType {
  const { workflowName, nodes, hasImageGeneration, hasDataExtraction } = context
  const nameLower = workflowName.toLowerCase()

  // LinkedIn content
  if (nameLower.includes('linkedin') || nameLower.includes('post')) {
    return 'linkedin-post'
  }

  // Keywords/SEO
  if (nameLower.includes('keyword') || nameLower.includes('seo') || nameLower.includes('niche')) {
    return 'keywords'
  }

  // Data extraction
  if (hasDataExtraction || nameLower.includes('extract') || nameLower.includes('scrape')) {
    return 'data'
  }

  // Report generation
  if (nameLower.includes('report') || nameLower.includes('analysis') || nameLower.includes('summary')) {
    return 'report'
  }

  return 'custom'
}

/**
 * Generate a compelling tagline for the playbook
 */
function generateTagline(name: string, description: string | undefined, context: PresentationContext): string {
  const { hasAI, hasImageGeneration, hasWebScraping } = context
  const nameLower = name.toLowerCase()

  // LinkedIn workflows
  if (nameLower.includes('linkedin')) {
    if (hasImageGeneration) {
      return 'Genera posts profesionales de LinkedIn con imágenes IA en minutos'
    }
    return 'Crea contenido de LinkedIn de alto impacto con IA'
  }

  // SEO/Keywords workflows
  if (nameLower.includes('keyword') || nameLower.includes('seo')) {
    return 'Descubre las mejores keywords para tu nicho con análisis IA'
  }

  // Content generation
  if (nameLower.includes('content') || nameLower.includes('article') || nameLower.includes('blog')) {
    return 'Genera contenido de calidad basado en investigación automatizada'
  }

  // Data extraction
  if (nameLower.includes('extract') || nameLower.includes('scrape')) {
    return 'Extrae y estructura datos de la web automáticamente'
  }

  // Lead generation
  if (nameLower.includes('lead') || nameLower.includes('prospect')) {
    return 'Encuentra y califica leads de manera automatizada'
  }

  // Default with AI mention if applicable
  if (hasAI) {
    return `Automatiza tu proceso de ${formatWorkflowName(name)} con IA`
  }

  return description || `Ejecuta ${formatWorkflowName(name)} paso a paso`
}

/**
 * Generate value proposition based on workflow capabilities
 */
function generateValueProposition(context: PresentationContext): string[] {
  const propositions: string[] = []
  const { workflowName, hasAI, hasImageGeneration, hasWebScraping, hasDataExtraction, stepCount } = context
  const nameLower = workflowName.toLowerCase()

  // AI-generated content
  if (hasAI) {
    propositions.push('Contenido generado con inteligencia artificial de última generación')
  }

  // Image generation
  if (hasImageGeneration) {
    propositions.push('Imágenes profesionales generadas con IA incluidas')
  }

  // Web scraping/research
  if (hasWebScraping) {
    propositions.push('Investigación automatizada de múltiples fuentes en tiempo real')
  }

  // Data extraction
  if (hasDataExtraction) {
    propositions.push('Datos estructurados listos para exportar y usar')
  }

  // LinkedIn specific
  if (nameLower.includes('linkedin')) {
    propositions.push('Post listo para publicar con hook que genera engagement')
    propositions.push('Formato optimizado para el algoritmo de LinkedIn')
  }

  // SEO specific
  if (nameLower.includes('seo') || nameLower.includes('keyword')) {
    propositions.push('Keywords con métricas de dificultad y volumen')
    propositions.push('Análisis de competencia incluido')
  }

  // If we don't have enough propositions, add generic ones
  if (propositions.length < 3) {
    propositions.push(`Proceso guiado en ${stepCount} pasos simples`)
    propositions.push('Resultados en minutos, no horas')
  }

  return propositions.slice(0, 4) // Max 4 propositions
}

/**
 * Calculate estimated time based on workflow complexity
 */
function calculateEstimatedTime(stepCount: number, hasAI: boolean, hasImageGeneration: boolean, hasWebScraping: boolean): string {
  let baseMinutes = stepCount * 0.5 // Base: 30 seconds per step

  if (hasAI) baseMinutes += 1 // AI adds ~1 minute
  if (hasImageGeneration) baseMinutes += 1 // Image gen adds ~1 minute
  if (hasWebScraping) baseMinutes += 1.5 // Web scraping adds ~1.5 minutes

  const minMinutes = Math.max(1, Math.floor(baseMinutes))
  const maxMinutes = Math.ceil(baseMinutes * 1.5)

  if (maxMinutes <= 2) return '1-2 minutos'
  if (maxMinutes <= 5) return `${minMinutes}-${maxMinutes} minutos`
  return `${minMinutes}-${maxMinutes} minutos`
}

/**
 * Calculate estimated cost based on services used
 */
function calculateEstimatedCost(context: PresentationContext): string {
  const { nodes, hasAI, hasImageGeneration, hasWebScraping } = context
  let estimatedCost = 0

  // AI processing (OpenRouter, OpenAI, etc.)
  if (hasAI) {
    estimatedCost += 0.02 // ~$0.02 per AI call average
  }

  // Image generation
  if (hasImageGeneration) {
    estimatedCost += 0.03 // ~$0.03 per image
  }

  // Web scraping (Dumpling AI, etc.)
  if (hasWebScraping) {
    estimatedCost += 0.01 // ~$0.01 per scrape
  }

  // Count additional API calls
  const apiCallCount = nodes.filter(n =>
    n.type.toLowerCase().includes('http') ||
    n.type.toLowerCase().includes('api')
  ).length

  estimatedCost += apiCallCount * 0.005 // ~$0.005 per API call

  if (estimatedCost === 0) return 'Gratis'
  if (estimatedCost < 0.01) return '<$0.01 USD'
  if (estimatedCost < 0.1) return `~$${estimatedCost.toFixed(2)} USD`
  return `~$${estimatedCost.toFixed(2)} USD`
}

/**
 * Detect required services from node types
 */
function detectRequiredServices(nodes: PresentationContext['nodes']): PlaybookPresentation['requiredServices'] {
  const services: PlaybookPresentation['requiredServices'] = []
  const addedKeys = new Set<string>()

  for (const node of nodes) {
    const typeLower = node.type.toLowerCase()
    const nameLower = node.name.toLowerCase()

    // OpenRouter / OpenAI
    if ((typeLower.includes('openai') || typeLower.includes('llm') || typeLower.includes('chat') ||
         nameLower.includes('gpt') || nameLower.includes('openai')) && !addedKeys.has('openrouter')) {
      services.push({
        key: 'openrouter',
        name: 'OpenRouter (IA)',
        description: 'Procesa y genera contenido con modelos de IA',
      })
      addedKeys.add('openrouter')
    }

    // Anthropic
    if ((typeLower.includes('anthropic') || nameLower.includes('claude')) && !addedKeys.has('anthropic')) {
      services.push({
        key: 'anthropic',
        name: 'Anthropic (Claude)',
        description: 'Procesa contenido con Claude AI',
      })
      addedKeys.add('anthropic')
    }

    // Dumpling AI (for scraping/search)
    if ((typeLower.includes('dumpling') || nameLower.includes('dumpling') ||
         (typeLower.includes('http') && (nameLower.includes('search') || nameLower.includes('scrape')))) &&
        !addedKeys.has('dumpling')) {
      services.push({
        key: 'dumpling',
        name: 'Dumpling AI',
        description: 'Busca y extrae contenido de la web',
      })
      addedKeys.add('dumpling')
    }

    // SERP API
    if ((typeLower.includes('serp') || nameLower.includes('serp') || nameLower.includes('google search')) &&
        !addedKeys.has('serp')) {
      services.push({
        key: 'serp',
        name: 'SERP API',
        description: 'Obtiene resultados de búsqueda de Google',
      })
      addedKeys.add('serp')
    }

    // Image generation (FLUX, DALL-E, etc.)
    if ((typeLower.includes('flux') || typeLower.includes('dall') || typeLower.includes('image') ||
         nameLower.includes('image') || nameLower.includes('flux')) && !addedKeys.has('image_gen')) {
      // Check if already has dumpling for image gen
      if (!addedKeys.has('dumpling')) {
        services.push({
          key: 'dumpling',
          name: 'Dumpling AI / FLUX',
          description: 'Genera imágenes con IA',
        })
        addedKeys.add('dumpling')
      }
    }
  }

  return services.length > 0 ? services : undefined
}

/**
 * Generate an example preview text based on output type
 */
function generateExamplePreview(context: PresentationContext, outputType: PreviewOutputType): string {
  const { workflowName } = context
  const nameLower = workflowName.toLowerCase()

  switch (outputType) {
    case 'linkedin-post':
      return '🚀 La inteligencia artificial está transformando el marketing B2B de formas que pocos anticipan.\n\nDespués de analizar las últimas tendencias, descubrí 3 estrategias que están generando resultados increíbles...'

    case 'keywords':
      return '📊 Keywords encontradas:\n• "marketing b2b" - Vol: 12K, Dif: 45\n• "estrategia digital" - Vol: 8K, Dif: 38\n• "automation tools" - Vol: 5K, Dif: 32'

    case 'data':
      return '📋 Datos extraídos:\n• 25 registros procesados\n• 3 fuentes analizadas\n• Exportación lista en CSV/JSON'

    case 'report':
      return '📝 Reporte generado:\n• Análisis completo del mercado\n• Insights clave identificados\n• Recomendaciones actionables'

    default:
      return `Resultado de ${formatWorkflowName(workflowName)} listo para revisar y exportar.`
  }
}

/**
 * Format workflow name for display
 */
function formatWorkflowName(name: string): string {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}
