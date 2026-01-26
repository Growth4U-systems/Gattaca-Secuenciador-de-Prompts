/**
 * LinkedIn Post Generator Playbook
 *
 * Converted from n8n workflow: "Auto-Generate LinkedIn Posts from Articles with Dumpling AI and GPT-4o"
 *
 * Flow:
 * 1. User provides a topic
 * 2. Search and scrape top 3 articles on the topic (Dumpling AI)
 * 3. AI summarizes articles and generates LinkedIn post + image prompt (GPT-4o)
 * 4. Generate image from prompt (Dumpling AI / FLUX.1-pro)
 * 5. Review and export the final post with image
 */

import { PlaybookConfig, StepGuidance, PlaybookPresentation } from '../types'

/**
 * Step Guidance Configurations
 * These provide clear instructions to users at each step
 */
const STEP_GUIDANCE: Record<string, StepGuidance> = {
  define_topic: {
    description: 'Ingrese el tema sobre el cual desea crear un post de LinkedIn. El sistema buscará los mejores artículos sobre este tema.',
    userActions: [
      'Escriba un tema específico pero amplio (3-5 palabras)',
      'Evite temas demasiado genéricos como "marketing" o "tecnología"',
      'Sea específico: "IA aplicada al marketing B2B" es mejor que solo "IA"',
      'Puede incluir tendencias actuales o temas de su industria',
    ],
    completionCriteria: {
      description: 'El tema debe tener al menos 3 caracteres',
      type: 'input_required',
      minCount: 3,
    },
  },
  search_articles: {
    description: 'El sistema buscará y analizará los 3 artículos más relevantes sobre su tema usando Dumpling AI.',
    userActions: [
      'Confirme que el tema ingresado es correcto',
      'Espere mientras el sistema busca y descarga los artículos',
      'El proceso puede tomar 30-45 segundos dependiendo de la disponibilidad',
      'Revise que los artículos encontrados sean relevantes',
    ],
    completionCriteria: {
      description: 'La búsqueda debe completarse con al menos 1 artículo encontrado',
      type: 'auto_complete',
    },
  },
  generate_post: {
    description: 'La IA (GPT-4o) analizará los artículos y generará un post profesional de LinkedIn junto con un prompt para la imagen.',
    userActions: [
      'Confirme el tono y audiencia deseada en las variables',
      'La IA generará el post basándose en los artículos encontrados',
      'Revise que el contenido sea preciso y atractivo',
      'El sistema también generará un prompt para crear la imagen',
    ],
    completionCriteria: {
      description: 'El post debe generarse exitosamente',
      type: 'auto_complete',
    },
  },
  generate_image: {
    description: 'FLUX.1-pro generará una imagen visual profesional basada en el prompt creado por la IA.',
    userActions: [
      'Espere mientras se genera la imagen (15-30 segundos)',
      'La imagen se creará específicamente para complementar su post',
      'Revise que la imagen sea apropiada para LinkedIn',
    ],
    completionCriteria: {
      description: 'La imagen debe generarse exitosamente',
      type: 'auto_complete',
    },
  },
  review_post: {
    description: 'Revise el post completo junto con la imagen generada. Puede editar el texto antes de exportar.',
    userActions: [
      'Lea el post completo y verifique la información',
      'Observe la imagen generada y confirme que es apropiada',
      'Edite el texto si necesita ajustar algo',
      'Copie el post para publicarlo en LinkedIn',
    ],
    completionCriteria: {
      description: 'Confirme que está satisfecho con el resultado',
      type: 'manual',
    },
  },
}

/**
 * Presentation metadata for the intro screen
 */
const PRESENTATION: PlaybookPresentation = {
  tagline: 'Genera posts profesionales de LinkedIn en minutos con investigación IA',
  valueProposition: [
    'Post listo para publicar con hook atractivo que genera engagement',
    'Imagen profesional generada con IA (FLUX.1-pro)',
    'Contenido basado en investigación de 3 artículos verificados',
    'Fuentes incluidas para mayor credibilidad',
  ],
  exampleOutput: {
    type: 'linkedin-post',
    preview: {
      text: 'La inteligencia artificial está transformando el marketing B2B de formas que pocos anticipan. Después de analizar las últimas tendencias, descubrí 3 estrategias que están generando resultados increíbles...',
    },
  },
  estimatedTime: '2-3 minutos',
  estimatedCost: '~$0.05 USD',
  requiredServices: [
    {
      key: 'openrouter',
      name: 'OpenRouter (IA)',
      description: 'Genera el contenido del post usando GPT-4o',
    },
    {
      key: 'dumpling',
      name: 'Dumpling AI',
      description: 'Busca y extrae artículos relevantes',
    },
  ],
}

export const linkedinPostGeneratorConfig: PlaybookConfig = {
  id: 'linkedin-post-generator',
  type: 'linkedin-post-generator',
  name: 'LinkedIn Post Generator',
  description: 'Genera posts profesionales de LinkedIn con imágenes IA a partir de cualquier tema usando investigación de artículos',
  icon: '💼',
  presentation: PRESENTATION,

  phases: [
    {
      id: 'input',
      name: 'Definir Tema',
      description: 'Ingrese el tema sobre el cual desea crear contenido',
      steps: [
        {
          id: 'define_topic',
          name: 'Selección de Tema',
          description: 'Ingrese un tema o palabra clave para investigar y crear contenido',
          type: 'input',
          executor: 'none',
          guidance: STEP_GUIDANCE.define_topic,
        }
      ]
    },
    {
      id: 'research',
      name: 'Investigación',
      description: 'Búsqueda y análisis de artículos relevantes sobre el tema',
      steps: [
        {
          id: 'search_articles',
          name: 'Buscar y Analizar Artículos',
          description: 'Buscando y extrayendo contenido de los mejores 3 artículos sobre su tema',
          type: 'auto',
          executor: 'api',
          apiEndpoint: '/api/playbook/linkedin-post-generator/search-articles',
          dependsOn: ['define_topic'],
          requiredApiKeys: ['dumpling'],
          guidance: STEP_GUIDANCE.search_articles,
          executionExplanation: {
            title: 'Búsqueda y Extracción de Artículos',
            steps: [
              'Busca los artículos más relevantes sobre el tema en Google',
              'Filtra y selecciona los 3 mejores resultados',
              'Descarga el contenido completo de cada artículo',
              'Procesa y estructura el texto para análisis',
              'Prepara el contenido para la generación del post',
            ],
            estimatedTime: '30-45 segundos',
            estimatedCost: 'Costo por búsqueda y scraping',
            costService: 'Dumpling AI',
          },
        }
      ]
    },
    {
      id: 'generate',
      name: 'Generación',
      description: 'Creación del post y la imagen con inteligencia artificial',
      steps: [
        {
          id: 'generate_post',
          name: 'Generar Post de LinkedIn',
          description: 'La IA resume los artículos y crea un post atractivo con prompt para imagen',
          type: 'auto',
          executor: 'api',
          apiEndpoint: '/api/playbook/linkedin-post-generator/generate-post',
          dependsOn: ['search_articles'],
          guidance: STEP_GUIDANCE.generate_post,
          executionExplanation: {
            title: 'Generación de Contenido con IA',
            steps: [
              'Analiza y resume el contenido de los 3 artículos',
              'Identifica los puntos clave y datos relevantes',
              'Genera un post profesional siguiendo el tono seleccionado',
              'Crea un hook atractivo para captar atención',
              'Genera un prompt visual para la imagen',
              'Incluye fuentes y referencias',
            ],
            estimatedTime: '15-30 segundos',
            estimatedCost: 'Costo por tokens de GPT-4o',
            costService: 'OpenRouter',
          },
        },
        {
          id: 'generate_image',
          name: 'Generar Imagen',
          description: 'Creando una imagen visual para acompañar su post de LinkedIn',
          type: 'auto',
          executor: 'api',
          apiEndpoint: '/api/playbook/linkedin-post-generator/generate-image',
          dependsOn: ['generate_post'],
          requiredApiKeys: ['dumpling'],
          guidance: STEP_GUIDANCE.generate_image,
          executionExplanation: {
            title: 'Generación de Imagen con FLUX.1-pro',
            steps: [
              'Utiliza el prompt visual generado por GPT-4o',
              'Envía solicitud a FLUX.1-pro para generación',
              'Crea una imagen profesional y atractiva',
              'Optimiza la imagen para LinkedIn',
            ],
            estimatedTime: '15-30 segundos',
            estimatedCost: 'Costo por generación de imagen',
            costService: 'Dumpling AI / FLUX.1-pro',
          },
        }
      ]
    },
    {
      id: 'review',
      name: 'Revisión',
      description: 'Revise y exporte su post de LinkedIn',
      steps: [
        {
          id: 'review_post',
          name: 'Revisar Post',
          description: 'Revise y edite su post de LinkedIn antes de publicar',
          type: 'auto_with_review',
          executor: 'none',
          dependsOn: ['generate_image'],
          guidance: STEP_GUIDANCE.review_post,
          executionExplanation: {
            title: 'Revisión Final',
            steps: [
              'Muestra el post completo generado',
              'Presenta la imagen creada',
              'Permite editar el texto si es necesario',
              'Proporciona opciones de exportación',
            ],
            estimatedTime: 'Según su revisión',
            estimatedCost: 'Sin costo adicional',
            costService: 'Ninguno',
          },
        }
      ]
    }
  ],

  variables: [
    {
      key: 'topic',
      label: 'Tema',
      description: 'El tema principal sobre el cual desea crear el post de LinkedIn',
      type: 'text',
      required: true,
      placeholder: 'Ej: IA aplicada al marketing B2B, Tendencias de trabajo remoto 2024',
    },
    {
      key: 'tone',
      label: 'Tono',
      description: 'El estilo y tono del contenido generado',
      type: 'select',
      required: false,
      defaultValue: 'conversational',
      options: [
        { value: 'professional', label: 'Profesional - Formal y serio' },
        { value: 'conversational', label: 'Conversacional - Amigable y cercano' },
        { value: 'thought-leadership', label: 'Thought Leadership - Experto y visionario' },
        { value: 'educational', label: 'Educativo - Informativo y didáctico' },
        { value: 'inspirational', label: 'Inspiracional - Motivador y positivo' }
      ]
    },
    {
      key: 'targetAudience',
      label: 'Audiencia Objetivo',
      description: 'Define quién consumirá este contenido para personalizar el mensaje',
      type: 'text',
      required: false,
      placeholder: 'Ej: Profesionales de marketing, Founders de startups, Desarrolladores',
    }
  ]
}

export default linkedinPostGeneratorConfig
