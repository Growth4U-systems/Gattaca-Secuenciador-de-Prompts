import { PlaybookConfig } from '../types'

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

export const videoViralIAConfig: PlaybookConfig = {
  id: 'video_viral_ia',
  type: 'video_viral_ia',
  name: 'Video Viral IA',
  description:
    'Genera videos virales ASMR usando IA - desde la idea hasta el video listo para publicar',
  icon: '🎬',

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
        },
        {
          id: 'review_idea',
          name: 'Revisar Idea',
          description: 'Revisa y aprueba o edita la idea generada',
          type: 'decision',
          executor: 'none',
          dependsOn: ['generate_idea'],
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
        },
        {
          id: 'generate_clips',
          name: 'Generar Clips de Video',
          description:
            'Genera clips de video con Wavespeed/Seedance AI (requiere API key)',
          type: 'auto_with_review',
          executor: 'llm', // Routes through execute-step which handles Wavespeed API
          dependsOn: ['generate_scenes'],
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
          executor: 'llm', // Routes through execute-step which handles Fal AI
          dependsOn: ['generate_clips'],
        },
        {
          id: 'compose_video',
          name: 'Componer Video Final',
          description: 'Une clips y audio con Fal AI FFmpeg (requiere API key)',
          type: 'auto_with_review',
          executor: 'llm', // Routes through execute-step which handles Fal AI FFmpeg
          dependsOn: ['generate_audio'],
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
        },
        {
          id: 'export',
          name: 'Exportar/Publicar',
          description:
            'Exporta el video o publica directamente a las plataformas',
          type: 'action',
          executor: 'none', // Will be 'api' when Blotato is integrated
          dependsOn: ['preview'],
          actionConfig: {
            label: 'Exportar Video',
            actionType: 'export',
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
