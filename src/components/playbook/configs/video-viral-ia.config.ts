import { PlaybookConfig, StepGuidance, PlaybookPresentation } from '../types'

/**
 * Video Viral IA Playbook Configuration
 *
 * Este playbook genera videos virales usando IA:
 * 1. IDEACIÓN: Genera idea viral + caption + hashtags
 * 2. PRODUCCIÓN: Genera prompts de escenas + clips de video
 * 3. POST-PRODUCCIÓN: Genera audio + compone video final
 * 4. PUBLICACIÓN: Preview + export/publicar
 *
 * Basado en workflow n8n: "Generate AI Videos with Seedance & Blotato"
 * https://n8n.io/workflows/5338
 */

/**
 * Step Guidance Configurations
 */
const STEP_GUIDANCE: Record<string, StepGuidance> = {
  generate_idea: {
    description: 'La IA genera una idea viral completa con caption, descripción del ambiente visual y sonoro.',
    userActions: [
      'Asegúrate de haber completado la configuración del tema y estilo',
      'Ejecuta la generación de idea',
      'Revisa el caption y hashtags generados',
      'Verifica que la descripción visual sea clara',
    ],
    completionCriteria: {
      description: 'La idea debe incluir caption, ambiente y descripción de audio',
      type: 'auto_complete',
    },
  },
  review_idea: {
    description: 'Revisa la idea generada y decide si continuarla, editarla o generar una nueva.',
    userActions: [
      'Lee el caption generado - ¿es atractivo y viral?',
      'Revisa la descripción del ambiente visual',
      'Verifica que el concepto sea coherente con tu marca',
      'Decide: aprobar, editar o regenerar',
    ],
    completionCriteria: {
      description: 'Debes tomar una decisión sobre la idea',
      type: 'manual',
    },
  },
  generate_scenes: {
    description: 'La IA descompone la idea en escenas detalladas con prompts visuales específicos.',
    userActions: [
      'Confirma la idea aprobada',
      'Ejecuta la generación de escenas',
      'Revisa cada prompt de escena - debe ser claro y específico',
      'Ajusta los prompts si es necesario antes de generar clips',
    ],
    completionCriteria: {
      description: 'Deben generarse entre 2-10 escenas con prompts',
      type: 'auto_complete',
    },
  },
  generate_clips: {
    description: 'Genera los clips de video usando IA (Wavespeed/Seedance). Este paso puede tomar varios minutos.',
    userActions: [
      'Confirma que tienes API key de Wavespeed configurada',
      'Ejecuta la generación de clips',
      'Espera mientras se generan los videos (2-5 min por clip)',
      'Revisa cada clip generado antes de continuar',
    ],
    completionCriteria: {
      description: 'Todos los clips deben generarse correctamente',
      type: 'auto_complete',
    },
  },
  generate_audio: {
    description: 'Genera el audio ASMR/satisfying usando Fal AI que acompañará a los clips.',
    userActions: [
      'Confirma que tienes API key de Fal AI configurada',
      'Revisa la descripción de audio de la idea',
      'Ejecuta la generación de audio',
      'Escucha el audio generado antes de componer',
    ],
    completionCriteria: {
      description: 'El audio debe generarse correctamente',
      type: 'auto_complete',
    },
  },
  compose_video: {
    description: 'Une los clips de video con el audio usando Fal AI FFmpeg para crear el video final.',
    userActions: [
      'Confirma que todos los clips están listos',
      'Confirma que el audio está listo',
      'Ejecuta la composición',
      'El proceso puede tomar 1-2 minutos',
    ],
    completionCriteria: {
      description: 'El video final debe generarse correctamente',
      type: 'auto_complete',
    },
  },
  preview: {
    description: 'Revisa el video final completo con el caption y hashtags antes de publicar.',
    userActions: [
      'Reproduce el video completo',
      'Verifica que el audio esté sincronizado',
      'Revisa el caption final',
      'Confirma los hashtags seleccionados',
    ],
    completionCriteria: {
      description: 'Debes revisar el video antes de publicar',
      type: 'manual',
    },
  },
  export: {
    description: 'Publica el video directamente a las plataformas seleccionadas usando Blotato.',
    userActions: [
      'Confirma que tienes Blotato configurado',
      'Selecciona las plataformas de destino',
      'Ajusta el caption si es diferente por plataforma',
      'Publica o descarga el video',
    ],
    completionCriteria: {
      description: 'El video debe publicarse o descargarse',
      type: 'manual',
    },
  },
}

/**
 * Presentation metadata for the intro screen
 */
const PRESENTATION: PlaybookPresentation = {
  tagline: 'Crea videos virales ASMR con IA - de idea a publicación en minutos',
  valueProposition: [
    'Videos ASMR/satisfying generados 100% con IA',
    'Caption viral y hashtags optimizados automáticamente',
    'Publicación directa a TikTok, Reels, Shorts y más',
    'Sin necesidad de edición manual ni software de video',
  ],
  exampleOutput: {
    type: 'custom',
    preview: {
      text: '🎬 Video generado:\n• 3 escenas ASMR de 10 segundos cada una\n• Audio satisfying sincronizado\n• Caption viral con 12 hashtags\n• Listo para TikTok, Reels y Shorts',
    },
  },
  estimatedTime: '10-15 minutos',
  estimatedCost: '~$0.50-2 USD',
  requiredServices: [
    {
      key: 'openrouter',
      name: 'OpenRouter (IA)',
      description: 'Genera ideas, captions y prompts de escenas',
    },
    {
      key: 'wavespeed',
      name: 'Wavespeed/Seedance',
      description: 'Genera los clips de video con IA',
    },
    {
      key: 'fal',
      name: 'Fal AI',
      description: 'Genera audio y compone el video final',
    },
    {
      key: 'blotato',
      name: 'Blotato',
      description: 'Publica a múltiples plataformas',
    },
  ],
}

export const videoViralIAConfig: PlaybookConfig = {
  id: 'video_viral_ia',
  type: 'video_viral_ia',
  name: 'Video Viral IA',
  description:
    'Genera videos virales ASMR usando IA - desde la idea hasta el video listo para publicar',
  icon: '🎬',
  presentation: PRESENTATION,

  phases: [
    // =========================================
    // FASE 1: IDEACIÓN
    // =========================================
    {
      id: 'ideation',
      name: 'Ideación',
      description: 'Genera y refina la idea viral para tu video',
      steps: [
        {
          id: 'generate_idea',
          name: 'Generar Idea Viral',
          description:
            'La IA genera una idea viral con caption, environment y descripción de audio',
          type: 'auto_with_review',
          executor: 'llm',
          promptKey: 'step_1_1_generate_idea',
          guidance: STEP_GUIDANCE.generate_idea,
          executionExplanation: {
            title: 'Generación de Idea Viral',
            steps: [
              'Analiza el tema y estilo seleccionados',
              'Genera concepto viral basado en tendencias',
              'Crea caption atractivo con hook',
              'Describe el ambiente visual detalladamente',
              'Define el tipo de audio/sonido',
              'Genera hashtags relevantes',
            ],
            estimatedTime: '15-30 segundos',
            estimatedCost: '~$0.03',
            costService: 'OpenRouter',
          },
        },
        {
          id: 'review_idea',
          name: 'Revisar Idea',
          description: 'Revisa y aprueba o edita la idea generada',
          type: 'decision',
          executor: 'none',
          dependsOn: ['generate_idea'],
          guidance: STEP_GUIDANCE.review_idea,
          decisionConfig: {
            question: '¿Apruebas esta idea para el video?',
            optionsFrom: 'fixed',
            fixedOptions: [
              { id: 'approve', label: 'Aprobar y continuar' },
              { id: 'edit', label: 'Editar idea' },
              { id: 'regenerate', label: 'Generar nueva idea' },
            ],
            multiSelect: false,
            minSelections: 1,
          },
          executionExplanation: {
            title: 'Revisión Manual',
            steps: [
              'Muestra la idea generada completa',
              'Permite aprobar, editar o regenerar',
              'La edición permite modificar caption y prompts',
              'Regenerar crea una idea completamente nueva',
            ],
            estimatedTime: '1-3 minutos (manual)',
            estimatedCost: 'Sin costo',
            costService: 'Ninguno',
          },
        },
      ],
    },

    // =========================================
    // FASE 2: PRODUCCIÓN DE ESCENAS
    // =========================================
    {
      id: 'production',
      name: 'Producción',
      description: 'Genera las escenas y clips de video',
      steps: [
        {
          id: 'generate_scenes',
          name: 'Generar Prompts de Escenas',
          description:
            'La IA genera descripciones detalladas para cada escena del video',
          type: 'auto_with_review',
          executor: 'llm',
          promptKey: 'step_2_1_generate_scenes',
          dependsOn: ['review_idea'],
          guidance: STEP_GUIDANCE.generate_scenes,
          executionExplanation: {
            title: 'Generación de Escenas',
            steps: [
              'Divide la idea en el número de escenas configurado',
              'Genera prompt visual detallado para cada escena',
              'Incluye movimientos de cámara sugeridos',
              'Especifica iluminación y colores',
              'Calcula duración de cada escena',
            ],
            estimatedTime: '20-40 segundos',
            estimatedCost: '~$0.05',
            costService: 'OpenRouter',
          },
        },
        {
          id: 'generate_clips',
          name: 'Generar Clips de Video',
          description:
            'Genera clips de video con Wavespeed/Seedance AI (requiere API key)',
          type: 'auto_with_review',
          executor: 'llm',
          dependsOn: ['generate_scenes'],
          requiredApiKeys: ['wavespeed'],
          guidance: STEP_GUIDANCE.generate_clips,
          executionExplanation: {
            title: 'Generación de Clips con IA',
            steps: [
              'Envía cada prompt de escena a Wavespeed/Seedance',
              'Genera clips de video individuales',
              'Cada clip toma 2-5 minutos',
              'Descarga los clips generados',
              'Permite regenerar clips específicos',
            ],
            estimatedTime: '5-15 minutos',
            estimatedCost: '~$0.20-0.50',
            costService: 'Wavespeed/Seedance',
          },
        },
      ],
    },

    // =========================================
    // FASE 3: POST-PRODUCCIÓN
    // =========================================
    {
      id: 'post_production',
      name: 'Post-Producción',
      description: 'Genera audio y compone el video final',
      steps: [
        {
          id: 'generate_audio',
          name: 'Generar Audio',
          description: 'Genera audio ASMR/satisfying con Fal AI (requiere API key)',
          type: 'auto_with_review',
          executor: 'llm',
          dependsOn: ['generate_clips'],
          requiredApiKeys: ['fal'],
          guidance: STEP_GUIDANCE.generate_audio,
          executionExplanation: {
            title: 'Generación de Audio',
            steps: [
              'Usa la descripción de audio de la idea',
              'Genera audio ASMR/satisfying con Fal AI',
              'Ajusta duración al total del video',
              'Proporciona preview del audio',
            ],
            estimatedTime: '30-60 segundos',
            estimatedCost: '~$0.05',
            costService: 'Fal AI',
          },
        },
        {
          id: 'compose_video',
          name: 'Componer Video Final',
          description: 'Une clips y audio con Fal AI FFmpeg (requiere API key)',
          type: 'auto_with_review',
          executor: 'llm',
          dependsOn: ['generate_audio'],
          requiredApiKeys: ['fal'],
          guidance: STEP_GUIDANCE.compose_video,
          executionExplanation: {
            title: 'Composición Final',
            steps: [
              'Concatena todos los clips en orden',
              'Sincroniza el audio con el video',
              'Aplica transiciones entre clips',
              'Exporta en el formato seleccionado',
              'Genera video final listo para publicar',
            ],
            estimatedTime: '1-2 minutos',
            estimatedCost: '~$0.10',
            costService: 'Fal AI FFmpeg',
          },
        },
      ],
    },

    // =========================================
    // FASE 4: PUBLICACIÓN
    // =========================================
    {
      id: 'publication',
      name: 'Publicación',
      description: 'Preview final y publicación en plataformas',
      steps: [
        {
          id: 'preview',
          name: 'Preview Final',
          description: 'Revisa el video final con caption y hashtags',
          type: 'display',
          executor: 'none',
          dependsOn: ['compose_video'],
          guidance: STEP_GUIDANCE.preview,
          executionExplanation: {
            title: 'Vista Previa',
            steps: [
              'Muestra el video final completo',
              'Presenta el caption y hashtags',
              'Permite descargar el video',
              'Confirma antes de publicar',
            ],
            estimatedTime: '1-2 minutos (manual)',
            estimatedCost: 'Sin costo',
            costService: 'Ninguno',
          },
        },
        {
          id: 'export',
          name: 'Publicar en Redes',
          description:
            'Publica el video a las plataformas seleccionadas via Blotato',
          type: 'auto_with_review',
          executor: 'api',
          dependsOn: ['preview'],
          requiredApiKeys: ['blotato'],
          guidance: STEP_GUIDANCE.export,
          actionConfig: {
            label: 'Publicar Video',
            actionType: 'export',
          },
          executionExplanation: {
            title: 'Publicación Multi-plataforma',
            steps: [
              'Conecta con Blotato API',
              'Sube el video a cada plataforma',
              'Publica con caption y hashtags',
              'Proporciona enlaces a las publicaciones',
            ],
            estimatedTime: '30-60 segundos por plataforma',
            estimatedCost: 'Según plan de Blotato',
            costService: 'Blotato',
          },
        },
      ],
    },
  ],

  // Variables needed for this playbook
  variables: [
    {
      key: 'content_theme',
      label: 'Tema del Contenido',
      type: 'text',
      required: true,
      description:
        'El tema principal de tu video viral. Sé específico para mejores resultados.',
      placeholder: 'Ej: cutting ASMR, satisfying slime, kinetic sand, soap cutting',
    },
    {
      key: 'content_style',
      label: 'Estilo de Contenido',
      type: 'select',
      required: true,
      defaultValue: 'ASMR',
      options: [
        { value: 'ASMR', label: 'ASMR' },
        { value: 'satisfying', label: 'Satisfying' },
        { value: 'educational', label: 'Educational' },
        { value: 'cinematic', label: 'Cinematic' },
        { value: 'comedy', label: 'Comedy' },
      ],
    },
    {
      key: 'video_duration',
      label: 'Duración (segundos)',
      type: 'number',
      required: true,
      defaultValue: 30,
      min: 10,
      max: 180,
    },
    {
      key: 'aspect_ratio',
      label: 'Formato de Video',
      type: 'select',
      required: true,
      defaultValue: '9:16',
      options: [
        { value: '9:16', label: '9:16 - Vertical (TikTok, Reels, Shorts)' },
        { value: '16:9', label: '16:9 - Horizontal (YouTube)' },
        { value: '1:1', label: '1:1 - Cuadrado (Instagram Feed)' },
      ],
    },
    {
      key: 'target_platforms',
      label: 'Plataformas Destino',
      type: 'multiselect',
      required: true,
      defaultValue: ['tiktok', 'instagram_reels', 'youtube_shorts'],
      options: [
        { value: 'tiktok', label: 'TikTok' },
        { value: 'instagram_reels', label: 'Instagram Reels' },
        { value: 'youtube_shorts', label: 'YouTube Shorts' },
        { value: 'youtube', label: 'YouTube' },
        { value: 'facebook', label: 'Facebook' },
        { value: 'linkedin', label: 'LinkedIn' },
        { value: 'twitter', label: 'Twitter/X' },
        { value: 'threads', label: 'Threads' },
        { value: 'bluesky', label: 'Bluesky' },
        { value: 'pinterest', label: 'Pinterest' },
      ],
    },
    {
      key: 'num_scenes',
      label: 'Número de Escenas',
      type: 'number',
      required: false,
      defaultValue: 3,
      min: 2,
      max: 10,
    },
    {
      key: 'hashtag_count',
      label: 'Cantidad de Hashtags',
      type: 'number',
      required: false,
      defaultValue: 12,
      min: 5,
      max: 30,
    },
  ],
}

export default videoViralIAConfig
