/**
 * Example Playbooks - Templates listos para usar
 * Cada playbook tiene un objetivo claro y usa automáticamente
 * los documentos del Context Lake del cliente
 *
 * Basado en mejores prácticas de n8n workflows pero con:
 * - Contexto de marca automático (Context Lake)
 * - Human-in-the-Loop integrado
 * - Tracking de costos por bloque
 * - Persistencia de estado
 */

import type { PlaybookConfig, PlaybookBlock, DocumentTier } from '@/types/v2.types'

// Metadata extendida para mostrar al usuario
export interface PlaybookMetadata {
  // Objetivo principal del playbook
  objective: string
  // Qué genera como resultado
  deliverable: string
  // Tiempo estimado de ejecución
  estimatedTime: string
  // Qué documentos del Context Lake necesita
  requiredContext: {
    tier: 1 | 2 | 3
    types: string[]
    description: string
  }[]
  // Ideal para qué casos de uso
  bestFor: string[]
  // Ejemplo de resultado
  exampleOutput?: string
  // Costo estimado en USD
  estimatedCost?: string
  // Basado en workflow externo
  basedOn?: {
    source: 'n8n' | 'make' | 'zapier' | 'custom'
    templateId?: string
    url?: string
  }
}

// =============================================================================
// Template: AI Viral Video Generator (COMPLETO)
// Based on n8n workflow 5338: Generate AI Viral Videos with Seedance
// Mejorado con Context Lake, HITL, y prompts optimizados
// =============================================================================

export const AI_VIRAL_VIDEO_FULL_PLAYBOOK: PlaybookConfig = {
  blocks: [
    // -------------------------------------------------------------------------
    // FASE 1: IDEACIÓN
    // -------------------------------------------------------------------------
    {
      id: 'block-idea',
      name: 'Generar Idea Viral',
      type: 'prompt',
      order: 0,
      description: 'Genera una idea de video optimizada para viralidad en la plataforma seleccionada',
      prompt: `Eres un experto en contenido viral para {{plataforma}} con más de 10 millones de views acumulados. Tu especialidad es crear hooks que detienen el scroll.

## CONTEXTO DE MARCA
{{#tier1:brand_dna}}
{{#tier1:tone_of_voice}}
{{#tier1:icp}}

## TAREA
Genera UNA idea de video de {{duracion}} segundos sobre el tema: {{tema}}

## REQUISITOS PARA VIRALIDAD
1. **Hook en 0.5 segundos**: El primer frame debe crear curiosidad irresistible
2. **Retención**: Algo nuevo cada 3 segundos (cambio de plano, revelación, giro)
3. **Formato mute-first**: El 70% de usuarios ve sin audio - debe funcionar solo con visual
4. **Emoción clara**: Elegir UNA emoción principal (sorpresa, curiosidad, FOMO, aspiración, satisfacción)
5. **Pattern interrupt**: Romper expectativas en algún momento

## ESTILO SOLICITADO: {{estilo}}

## OUTPUT (responde SOLO con este JSON)
{
  "titulo_interno": "título corto para identificación interna",
  "hook_visual": {
    "frame_inicial": "descripción exacta del primer frame (0-0.5s)",
    "accion_inmediata": "qué sucede en los primeros 2 segundos",
    "texto_overlay": "texto en pantalla si aplica (max 5 palabras) o null"
  },
  "concepto": "descripción del video en 2 oraciones máximo",
  "emocion_principal": "una sola emoción de la lista",
  "arco_narrativo": {
    "setup": "primeros 3-5 segundos",
    "desarrollo": "cuerpo del video",
    "payoff": "últimos 2-3 segundos + CTA"
  },
  "escenas_resumen": ["escena1 (Xs)", "escena2 (Xs)", "escena3 (Xs)", "escena4 (Xs)"],
  "cta_final": "acción deseada del viewer",
  "caption_preview": "primeras 2 líneas del caption para la plataforma",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "audio_direccion": "descripción general del audio ideal",
  "virality_hooks": ["por qué hook 1 funciona", "por qué hook 2 funciona"]
}`,
      model: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      temperature: 0.9,
      max_tokens: 2000,
      context_tiers: [1, 2],
      output_format: 'json',
    },

    // -------------------------------------------------------------------------
    // FASE 2: REVISIÓN DE IDEA (HITL)
    // -------------------------------------------------------------------------
    {
      id: 'block-review-idea',
      name: 'Revisar Idea',
      type: 'human_review',
      order: 1,
      description: 'Revisa y ajusta la idea antes de continuar con el detalle de escenas',
      hitl_config: {
        enabled: true,
        interface_type: 'edit',
        timeout_hours: 24,
        prompt: 'Revisa la idea del video. Puedes editar el concepto, hook, escenas o cualquier campo. Una vez aprobada, se generarán los prompts detallados para cada escena.',
      },
      receives_from: ['Generar Idea Viral'],
    },

    // -------------------------------------------------------------------------
    // FASE 3: DETALLE DE ESCENAS
    // -------------------------------------------------------------------------
    {
      id: 'block-scenes',
      name: 'Detallar Escenas para IA',
      type: 'prompt',
      order: 2,
      description: 'Genera prompts detallados para cada escena, listos para generadores de video IA',
      prompt: `Eres un director de fotografía especializado en videos verticales virales. Generas prompts técnicos para modelos de generación de video IA (Runway, Pika, Seedance, Kling).

## IDEA DE VIDEO APROBADA
{{step:Revisar Idea}}

## ESPECIFICACIONES TÉCNICAS
- Duración total: {{duracion}} segundos
- Aspect ratio: 9:16 (vertical, 1080x1920)
- Estilo: {{estilo}}
- FPS: 24-30

## PARA CADA ESCENA GENERA

### Prompt Visual (CRÍTICO - esto va directamente al modelo de video)
Descripción ultra-detallada que incluya:
- **Sujeto**: Qué/quién aparece, posición exacta, acción específica
- **Ambiente**: Locación, props, elementos de fondo, atmósfera
- **Iluminación**: Tipo (natural/artificial), dirección, color, intensidad, sombras
- **Textura/Detalle**: Nivel macro si aplica, materiales visibles
- **Movimiento**: Del sujeto Y de cámara

### Prompt Negativo
Qué evitar: blur, distortion, text, watermark, low quality, etc.

### Parámetros Técnicos
- Movimiento de cámara: static | slow_pan_left | slow_pan_right | slow_zoom_in | slow_zoom_out | orbit | tracking
- Velocidad: slow_motion (0.5x) | normal (1x) | slight_slow (0.75x)
- Transición al siguiente: hard_cut | dissolve | match_cut | morph

## OUTPUT (JSON)
{
  "metadata": {
    "duracion_total": {{duracion}},
    "num_escenas": X,
    "estilo_general": "{{estilo}}"
  },
  "escenas": [
    {
      "numero": 1,
      "nombre": "Hook Opener",
      "duracion_segundos": X,
      "timestamp": "0:00-0:0X",
      "prompt_visual": "Descripción de 150-250 palabras extremadamente detallada...",
      "prompt_negativo": "blur, distortion, text, watermark, deformed, low quality, artifacts",
      "camara": {
        "movimiento": "slow_zoom_in",
        "velocidad": "slow_motion",
        "angulo_inicial": "extreme_close_up",
        "angulo_final": "close_up"
      },
      "iluminacion": {
        "tipo": "golden_hour",
        "direccion": "backlit",
        "color_temp": "warm",
        "intensidad": "high_contrast"
      },
      "transicion_siguiente": "hard_cut",
      "texto_overlay": "texto si aplica o null",
      "audio_sync": "descripción del audio en este momento específico"
    }
  ],
  "notas_produccion": {
    "consistencia_visual": "notas para mantener coherencia entre escenas",
    "elementos_recurrentes": ["elemento1", "elemento2"],
    "paleta_color": ["#hex1", "#hex2", "#hex3"]
  }
}

IMPORTANTE:
- Los prompts visuales deben ser tan detallados que cualquier modelo de video IA genere resultados consistentes
- Mantén coherencia visual entre escenas (misma paleta, mismo sujeto si aplica)
- Cada escena debe tener una razón de ser para la narrativa`,
      model: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      temperature: 0.6,
      max_tokens: 4000,
      receives_from: ['Revisar Idea'],
      output_format: 'json',
    },

    // -------------------------------------------------------------------------
    // FASE 4: REVISIÓN DE ESCENAS (HITL)
    // -------------------------------------------------------------------------
    {
      id: 'block-review-scenes',
      name: 'Aprobar Escenas',
      type: 'human_review',
      order: 3,
      description: 'Revisa los prompts de cada escena antes de generar el audio',
      hitl_config: {
        enabled: true,
        interface_type: 'edit',
        timeout_hours: 48,
        prompt: 'Revisa cada escena. Puedes editar los prompts visuales, ajustar duraciones o reordenar. Estas descripciones se usarán para generar el video con IA.',
      },
      receives_from: ['Detallar Escenas para IA'],
    },

    // -------------------------------------------------------------------------
    // FASE 5: SCRIPT DE AUDIO
    // -------------------------------------------------------------------------
    {
      id: 'block-audio',
      name: 'Generar Script de Audio',
      type: 'prompt',
      order: 4,
      description: 'Genera el guión de audio sincronizado con las escenas',
      prompt: `Eres un director de audio para contenido viral en redes sociales.

## ESCENAS APROBADAS
{{step:Aprobar Escenas}}

## CONFIGURACIÓN
- ¿Tiene narración?: {{tiene_narracion}}
- Plataforma: {{plataforma}}
- Estilo: {{estilo}}

## TONO DE VOZ DE LA MARCA
{{#tier1:tone_of_voice}}

## TAREA
Genera el diseño de audio completo para el video.

{{#if tiene_narracion}}
### CON NARRACIÓN
El video tendrá voz en off. Genera:
1. Script palabra por palabra sincronizado con cada escena
2. Marcas de timing exactas
3. Indicaciones de tono (entusiasta, misterioso, casual, etc.)
4. Pausas dramáticas
5. Énfasis en palabras clave

El script debe:
- Ser conversacional y natural
- Tener hooks verbales cada 3-5 segundos
- Complementar (no describir) lo visual
- Mantener el tono de voz de la marca
{{else}}
### SIN NARRACIÓN
El video será solo visual con música/efectos. Genera:
1. Dirección musical detallada
2. Efectos de sonido por escena
3. Timing de beats importantes
{{/if}}

## OUTPUT (JSON)
{
  "tipo_audio": "narracion" | "musica_sfx" | "mixto",
  "musica": {
    "genero": "electronic / lo-fi / cinematic / etc",
    "mood": "uplifting / mysterious / energetic / etc",
    "bpm_sugerido": 120,
    "referencias": ["nombre de canción o artista similar 1", "referencia 2"],
    "estructura": {
      "intro": "0:00-0:03 - build up suave",
      "drop": "0:03 - beat drop con el hook visual",
      "desarrollo": "descripción",
      "outro": "descripción"
    },
    "licencia_nota": "buscar en Epidemic Sound / Artlist similar a referencias"
  },
  "script_por_escena": [
    {
      "escena_numero": 1,
      "timestamp": "0:00-0:03",
      "narracion": "texto exacto palabra por palabra" | null,
      "indicacion_voz": "susurro misterioso, pausa después de 'pero'" | null,
      "musica_momento": "build up, sin beat todavía",
      "sfx": ["woosh suave al aparecer texto", "ambient room tone"],
      "intensidad_audio": "low"
    }
  ],
  "voz_sugerida": {
    "genero": "masculina" | "femenina" | "neutral",
    "edad_aparente": "20s joven adulto",
    "acento": "neutro latinoamericano / español neutro",
    "ritmo": "rápido pero claro, pausas dramáticas en hooks",
    "referencia": "estilo similar a [creador conocido]"
  },
  "notas_mezcla": {
    "balance_voz_musica": "voz prominente, música -6dB durante narración",
    "ducking": "música baja cuando hay voz, sube en transiciones",
    "master_loudness": "-14 LUFS para redes sociales"
  }
}`,
      model: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      temperature: 0.7,
      max_tokens: 2500,
      context_tiers: [1],
      receives_from: ['Aprobar Escenas'],
      output_format: 'json',
    },

    // -------------------------------------------------------------------------
    // FASE 6: APROBACIÓN FINAL (HITL)
    // -------------------------------------------------------------------------
    {
      id: 'block-review-final',
      name: 'Aprobación Final del Brief',
      type: 'human_review',
      order: 5,
      description: 'Revisa el brief completo antes de generar el copy de distribución',
      hitl_config: {
        enabled: true,
        interface_type: 'approve_reject',
        timeout_hours: 72,
        prompt: 'Este es el brief final del video. Revisa que las escenas y el audio estén alineados. Al aprobar, se generará el copy para publicación.',
      },
      receives_from: ['Generar Script de Audio'],
    },

    // -------------------------------------------------------------------------
    // FASE 7: COPY PARA DISTRIBUCIÓN
    // -------------------------------------------------------------------------
    {
      id: 'block-copy',
      name: 'Generar Copy de Publicación',
      type: 'prompt',
      order: 6,
      description: 'Genera el copy optimizado para publicar en la plataforma',
      prompt: `Eres un experto en copywriting para {{plataforma}} con historial de posts virales.

## VIDEO BRIEF APROBADO
Idea: {{step:Revisar Idea}}

## CONTEXTO DE MARCA
{{#tier1:tone_of_voice}}
{{#tier1:icp}}

## TAREA
Genera el copy completo optimizado para {{plataforma}}.

## REQUISITOS POR PLATAFORMA

### Si es TikTok:
- Caption: 1-2 líneas MÁX, directo al punto
- Usar trends y lenguaje de la plataforma
- Primer comentario es CRUCIAL (pregunta para engagement)
- 3-5 hashtags (mix trending + nicho)
- Emojis: solo si van con la marca

### Si es Instagram Reels:
- Caption: puede ser más largo, 2-4 líneas
- Tono más aspiracional/estético
- Hashtags: 10-15 (pero revisar cuáles funcionan)
- Story teaser copy para promocionar
- Carrusel de seguimiento si aplica

### Si es YouTube Shorts:
- Título: MAX 60 caracteres, curiosity gap
- Descripción: breve, con links
- Solo 3 hashtags relevantes
- End screen CTA claro

## OUTPUT (JSON)
{
  "plataforma": "{{plataforma}}",
  "caption": {
    "linea_1": "hook del caption (la más importante)",
    "linea_2": "desarrollo si aplica",
    "cta": "llamada a la acción",
    "hashtags": ["#tag1", "#tag2", "#tag3"],
    "texto_completo": "el caption completo formateado"
  },
  "primer_comentario": {
    "texto": "pregunta o statement para generar respuestas",
    "timing": "publicar inmediatamente después del post"
  },
  "horario_optimo": {
    "dias": ["martes", "miercoles", "jueves"],
    "hora_local": "19:00-21:00",
    "timezone": "America/Mexico_City",
    "razon": "peak de engagement para audiencia LATAM millennials"
  },
  "estrategia_engagement": {
    "primeros_30min": "responder todos los comentarios rápido",
    "hashtag_challenge": "si aplica, hashtag propio para UGC",
    "collab_potencial": "creadores para duet/stitch"
  },
  "cross_posting": {
    "adaptar_para": ["Instagram Reels", "YouTube Shorts"],
    "cambios_necesarios": ["ajustar hashtags", "modificar CTA"]
  },
  "assets_adicionales": {
    "thumbnail_sugerido": "descripción del frame ideal para thumbnail",
    "story_teaser": "copy para story promocionando el video",
    "titulo_alternativo": "versión B para A/B test"
  }
}`,
      model: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      temperature: 0.8,
      max_tokens: 1500,
      context_tiers: [1],
      receives_from: ['Revisar Idea'],
      output_format: 'json',
    },

    // -------------------------------------------------------------------------
    // FASE 8: RESUMEN EJECUTIVO
    // -------------------------------------------------------------------------
    {
      id: 'block-summary',
      name: 'Compilar Brief Final',
      type: 'prompt',
      order: 7,
      description: 'Compila todo en un documento ejecutivo listo para producción',
      prompt: `Compila todos los outputs anteriores en un brief ejecutivo de producción.

## OUTPUTS ANTERIORES
Idea: {{step:Revisar Idea}}
Escenas: {{step:Aprobar Escenas}}
Audio: {{step:Generar Script de Audio}}
Copy: {{step:Generar Copy de Publicación}}

## TAREA
Crea un documento ejecutivo que cualquier equipo de producción pueda usar.

## OUTPUT (Markdown estructurado)
# Brief de Video: [Título]

## Resumen Ejecutivo
- **Plataforma**: {{plataforma}}
- **Duración**: {{duracion}}s
- **Estilo**: {{estilo}}
- **Emoción**: [emoción principal]

## Quick Stats
- Escenas: X
- Tiene narración: Sí/No
- Costo estimado producción: $X-X

## El Video en 30 Segundos
[Descripción ejecutiva del video completo]

## Hook
[El hook del video]

## Escenas (Resumen)
| # | Nombre | Duración | Acción Principal |
|---|--------|----------|------------------|
| 1 | ... | Xs | ... |

## Audio
- Tipo: [narración/música/mixto]
- Música: [género, BPM, referencias]
- Voz: [características si aplica]

## Copy para {{plataforma}}
[El copy completo listo para copiar/pegar]

## Checklist de Producción
- [ ] Grabar/generar clips de video
- [ ] Producir audio
- [ ] Editar y ensamblar
- [ ] Agregar textos/overlays
- [ ] Exportar 9:16 1080x1920
- [ ] Subir con copy preparado

## Archivos Adjuntos (referencias)
- Prompts de escenas: [link interno]
- Script de audio: [link interno]
- Assets de marca: [link interno]

---
Generado por Gattaca Playbooks
Fecha: [fecha]
`,
      model: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      temperature: 0.3,
      max_tokens: 2000,
      receives_from: ['Generar Copy de Publicación'],
      output_format: 'markdown',
    },
  ],

  context_requirements: {
    required_documents: ['brand_dna', 'tone_of_voice'],
    required_tiers: [1],
    dynamic_queries: [
      'tier:1 type:icp',
      'tier:2 type:campaign_brief recent:true',
    ],
  },

  input_schema: {
    tema: {
      type: 'textarea',
      required: true,
      label: 'Tema del video',
      description: 'Describe el tema principal. Ej: "5 señales de que estás quemándote en el trabajo" o "Cómo invertir tu primer millón"',
    },
    plataforma: {
      type: 'select',
      required: true,
      label: 'Plataforma principal',
      options: ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'LinkedIn Video'],
    },
    duracion: {
      type: 'select',
      required: true,
      label: 'Duración objetivo',
      options: ['15', '30', '60', '90'],
      description: 'Segundos. TikTok/Reels óptimo: 15-30s. Shorts: hasta 60s.',
    },
    estilo: {
      type: 'select',
      required: true,
      label: 'Estilo visual',
      options: [
        'Cinematográfico (cinematic, premium)',
        'Minimalista (clean, espacios)',
        'Energético (rápido, cortes)',
        'Aesthetic (colores, mood)',
        'Educativo (texto, gráficos)',
        'ASMR/Satisfying (texturas, macro)',
        'Documental (real, auténtico)',
      ],
    },
    tiene_narracion: {
      type: 'boolean',
      required: false,
      label: '¿Incluir narración de voz?',
      default: true,
      description: 'Si no, el video será solo visual con música/efectos',
    },
    objetivo_negocio: {
      type: 'select',
      required: false,
      label: 'Objetivo principal',
      options: ['Awareness (alcance)', 'Engagement (interacción)', 'Traffic (clicks)', 'Conversión (ventas)', 'Educación (valor)'],
    },
    referencia_url: {
      type: 'string',
      required: false,
      label: 'URL de video de referencia',
      description: 'Link a un video con el estilo que buscas (opcional)',
    },
  },

  output_config: {
    destination: 'asset_library',
    asset_type: 'video_brief',
    document_tier: 3,
    document_type: 'output',
  },
}

// =============================================================================
// Template: AI Viral Video Generator (Versión Simple)
// Para usuarios que quieren algo más rápido
// =============================================================================

export const AI_VIRAL_VIDEO_PLAYBOOK: PlaybookConfig = {
  blocks: [
    {
      id: 'block-idea',
      name: 'Generar Idea Viral',
      type: 'prompt',
      order: 0,
      prompt: `Eres un experto en contenido viral para {{plataforma}}.

Genera una idea de video corto ({{duracion}} segundos) sobre: {{tema}}

La idea debe:
- Captar atención en los primeros 3 segundos
- Tener un hook emocional claro
- Ser visualmente impactante
- Funcionar sin audio (la mayoría ve en silencio)

## CONTEXTO DE MARCA
{{#tier1:tone_of_voice}}

Responde con:
1. **Título**: Título clickbait del video
2. **Hook**: Los primeros 3 segundos (CRUCIAL)
3. **Concepto**: Descripción de 2-3 oraciones
4. **Escenas**: Lista de 3-5 escenas clave
5. **CTA**: Call to action final
6. **Hashtags**: 5 hashtags relevantes

Estilo: {{estilo}}`,
      model: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      temperature: 0.9,
      max_tokens: 1500,
      context_tiers: [1, 2],
      output_format: 'markdown',
    },
    {
      id: 'block-review-idea',
      name: 'Revisar Idea',
      type: 'human_review',
      order: 1,
      hitl_config: {
        enabled: true,
        interface_type: 'edit',
        timeout_hours: 24,
      },
      receives_from: ['Generar Idea Viral'],
    },
    {
      id: 'block-scenes',
      name: 'Detallar Escenas',
      type: 'prompt',
      order: 2,
      prompt: `Basándote en esta idea de video:

{{step:Revisar Idea}}

Genera prompts detallados para cada escena que puedan usarse en un generador de video IA (como Runway, Pika, Seedance).

Para cada escena incluye:
1. **Descripción visual**: Qué se ve exactamente (4-5 oraciones descriptivas)
2. **Movimiento de cámara**: Estático, zoom in, pan, etc.
3. **Iluminación**: Tipo de luz, colores dominantes
4. **Duración**: Segundos aproximados
5. **Transición**: Cómo conecta con la siguiente escena

Formato JSON:
{
  "escenas": [
    {
      "numero": 1,
      "prompt_visual": "...",
      "camara": "...",
      "iluminacion": "...",
      "duracion_segundos": 3,
      "transicion": "cut"
    }
  ]
}`,
      model: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      temperature: 0.7,
      max_tokens: 2000,
      receives_from: ['Revisar Idea'],
      output_format: 'json',
    },
    {
      id: 'block-script',
      name: 'Generar Guión de Audio',
      type: 'prompt',
      order: 3,
      prompt: `Basándote en las escenas del video:

{{step:Detallar Escenas}}

Genera el guión de audio/narración (si aplica) o la descripción del audio ambiente/música.

Incluye:
1. **Tipo de audio**: Narración, música, efectos, o combinación
2. **Tono**: Energético, misterioso, inspiracional, etc.
3. **Script de voz**: Si hay narración, el texto exacto
4. **Sincronización**: Qué audio va con qué escena
5. **Música sugerida**: Estilo, BPM, referencia

{{#if tiene_narracion}}
El video TENDRÁ narración. Escribe el script completo sincronizado con cada escena.
{{/if}}`,
      model: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      temperature: 0.6,
      max_tokens: 1000,
      receives_from: ['Detallar Escenas'],
      output_format: 'markdown',
    },
    {
      id: 'block-review-final',
      name: 'Aprobación Final',
      type: 'human_review',
      order: 4,
      hitl_config: {
        enabled: true,
        interface_type: 'approve_reject',
        timeout_hours: 48,
      },
      receives_from: ['Generar Guión de Audio'],
    },
    {
      id: 'block-copy',
      name: 'Generar Copy para Redes',
      type: 'prompt',
      order: 5,
      prompt: `Genera el copy de publicación para el video en {{plataforma}}.

Idea del video:
{{step:Revisar Idea}}

Genera:
1. **Caption principal**: 2-3 líneas que enganchen
2. **Hashtags optimizados**: 10-15 hashtags (mezcla popular + nicho)
3. **Primer comentario**: Pregunta para engagement
4. **Horario sugerido**: Mejor hora para publicar según la plataforma

Adapta el tono y formato a {{plataforma}}:
- TikTok: Casual, trends, emojis
- Instagram Reels: Aspiracional, estético
- YouTube Shorts: Informativo, ganchos curiosidad`,
      model: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      temperature: 0.8,
      max_tokens: 800,
      context_tiers: [1],
      receives_from: ['Revisar Idea'],
      output_format: 'markdown',
    },
  ],
  context_requirements: {
    required_documents: ['tone_of_voice', 'brand_dna'],
    dynamic_queries: [],
  },
  input_schema: {
    tema: {
      type: 'textarea',
      required: true,
      label: 'Tema del video',
      description: 'Sobre qué será el video. Ej: "5 hábitos de millonarios"',
    },
    plataforma: {
      type: 'select',
      required: true,
      label: 'Plataforma principal',
      options: ['TikTok', 'Instagram Reels', 'YouTube Shorts'],
    },
    duracion: {
      type: 'select',
      required: true,
      label: 'Duración objetivo',
      options: ['15', '30', '60'],
      description: 'Duración en segundos',
    },
    estilo: {
      type: 'select',
      required: true,
      label: 'Estilo visual',
      options: ['Cinematográfico', 'Minimalista', 'Energético', 'Aesthetic', 'Educativo'],
    },
    tiene_narracion: {
      type: 'boolean',
      required: false,
      label: '¿Incluir narración?',
    },
  },
  output_config: {
    destination: 'asset_library',
    asset_type: 'video_brief',
  },
}

// =============================================================================
// Template: Content Research & Strategy
// =============================================================================

export const CONTENT_RESEARCH_PLAYBOOK: PlaybookConfig = {
  blocks: [
    {
      id: 'block-research',
      name: 'Investigar Tendencias',
      type: 'prompt',
      order: 0,
      prompt: `Analiza las tendencias actuales en {{industria}} para el mercado {{mercado}}.

Fuentes a considerar:
- Tendencias de búsqueda
- Temas virales en redes sociales
- Competidores principales
- Noticias del sector

Genera un reporte con:
1. **Top 5 Tendencias**: Qué está funcionando ahora
2. **Oportunidades de Contenido**: Gaps que podemos llenar
3. **Formatos Recomendados**: Qué tipo de contenido crear
4. **Keywords Sugeridas**: Términos con potencial
5. **Competidores a Monitorear**: Quiénes están haciendo buen contenido

Usa los documentos de contexto para alinear con nuestra marca.`,
      model: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      temperature: 0.5,
      max_tokens: 2500,
      context_tiers: [1, 2],
      output_format: 'markdown',
    },
    {
      id: 'block-calendar',
      name: 'Proponer Calendario',
      type: 'prompt',
      order: 1,
      prompt: `Basándote en la investigación de tendencias:

{{step:Investigar Tendencias}}

Crea una propuesta de calendario de contenido para los próximos {{semanas}} semanas.

Para cada semana incluye:
- 2-3 piezas de contenido
- Tipo de contenido (post, video, carrusel, etc.)
- Tema específico
- Plataforma principal
- Objetivo (awareness, engagement, conversión)

Formato tabla markdown.`,
      model: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      temperature: 0.7,
      max_tokens: 2000,
      receives_from: ['Investigar Tendencias'],
      output_format: 'markdown',
    },
    {
      id: 'block-review',
      name: 'Aprobar Calendario',
      type: 'human_review',
      order: 2,
      hitl_config: {
        enabled: true,
        interface_type: 'edit',
        timeout_hours: 72,
      },
      receives_from: ['Proponer Calendario'],
    },
  ],
  context_requirements: {
    required_documents: ['icp', 'competitor_analysis'],
    dynamic_queries: [],
  },
  input_schema: {
    industria: {
      type: 'string',
      required: true,
      label: 'Industria',
      description: 'Ej: SaaS, E-commerce, Fintech',
    },
    mercado: {
      type: 'select',
      required: true,
      label: 'Mercado objetivo',
      options: ['LATAM', 'España', 'USA Hispanic', 'Global'],
    },
    semanas: {
      type: 'select',
      required: true,
      label: 'Semanas a planificar',
      options: ['2', '4', '8', '12'],
    },
  },
  output_config: {
    destination: 'context_lake',
    document_tier: 2,
    document_type: 'campaign_brief',
  },
}

// =============================================================================
// Template: Competitor Deep Dive
// =============================================================================

export const COMPETITOR_ANALYSIS_PLAYBOOK: PlaybookConfig = {
  blocks: [
    {
      id: 'block-profile',
      name: 'Perfil del Competidor',
      type: 'prompt',
      order: 0,
      prompt: `Analiza el competidor: {{nombre_competidor}}
URL: {{url_competidor}}

Genera un perfil completo:

## Información General
- Propuesta de valor principal
- Segmento objetivo
- Modelo de negocio

## Presencia Digital
- Canales activos
- Frecuencia de publicación
- Engagement promedio estimado

## Fortalezas y Debilidades
- ¿Qué hacen bien?
- ¿Dónde hay oportunidades para nosotros?

## Contenido Destacado
- Tipos de contenido que funcionan
- Temas recurrentes
- Formato preferido`,
      model: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      temperature: 0.4,
      max_tokens: 2000,
      context_tiers: [1],
      output_format: 'markdown',
    },
    {
      id: 'block-comparison',
      name: 'Comparativa con Nosotros',
      type: 'prompt',
      order: 1,
      prompt: `Basándote en el perfil del competidor:

{{step:Perfil del Competidor}}

Y usando nuestros documentos de Brand DNA e ICP, genera una comparativa:

| Aspecto | Nosotros | {{nombre_competidor}} | Oportunidad |
|---------|----------|----------------------|-------------|
| Propuesta de valor | ... | ... | ... |
| Audiencia | ... | ... | ... |
| Contenido | ... | ... | ... |
| Diferenciadores | ... | ... | ... |

## Recomendaciones Estratégicas
1. Cómo diferenciarnos
2. Qué podemos aprender
3. Gaps que podemos llenar`,
      model: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      temperature: 0.5,
      max_tokens: 1500,
      context_tiers: [1],
      receives_from: ['Perfil del Competidor'],
      output_format: 'markdown',
    },
  ],
  context_requirements: {
    required_documents: ['brand_dna', 'icp'],
    dynamic_queries: [],
  },
  input_schema: {
    nombre_competidor: {
      type: 'string',
      required: true,
      label: 'Nombre del competidor',
    },
    url_competidor: {
      type: 'string',
      required: true,
      label: 'URL del competidor',
    },
  },
  output_config: {
    destination: 'context_lake',
    document_tier: 2,
    document_type: 'competitor_analysis',
  },
}

// =============================================================================
// Export all templates
// =============================================================================

export const PLAYBOOK_TEMPLATES = {
  'ai-viral-video-pro': {
    name: 'Video Viral IA (Completo)',
    description: 'Brief profesional de video viral con 8 bloques, 3 puntos de revisión humana, y copy multi-plataforma. Basado en workflow n8n #5338 mejorado.',
    category: 'video',
    tags: ['VIDEO', 'VIRAL', 'PRODUCCION', 'PRO'],
    config: AI_VIRAL_VIDEO_FULL_PLAYBOOK,
    metadata: {
      objective: 'Generar un brief de producción completo para videos virales, listo para equipo de video o herramientas IA',
      deliverable: 'Brief con: idea viral, prompts de escenas para IA, script de audio sincronizado, copy multi-plataforma',
      estimatedTime: '5-8 minutos (incluyendo revisiones)',
      estimatedCost: '~$0.08-0.12 USD en tokens',
      requiredContext: [
        {
          tier: 1,
          types: ['brand_dna', 'tone_of_voice', 'icp'],
          description: 'Para mantener consistencia de marca y hablar a la audiencia correcta',
        },
        {
          tier: 2,
          types: ['campaign_brief'],
          description: 'Para alinear con campañas activas (opcional)',
        },
      ],
      bestFor: [
        'Equipos de producción de video',
        'Creadores que usan herramientas de video IA',
        'Campañas de awareness en redes sociales',
        'Contenido educativo o de entretenimiento',
      ],
      basedOn: {
        source: 'n8n',
        templateId: '5338',
        url: 'https://n8n.io/workflows/5338-generate-ai-viral-videos-with-seedance-and-upload-to-tiktok-youtube-and-instagram/',
      },
    } as PlaybookMetadata,
  },
  'ai-viral-video': {
    name: 'Video Viral IA (Rápido)',
    description: 'Brief rápido para videos cortos virales. Idea, escenas, guión y copy en menos pasos.',
    category: 'video',
    tags: ['VIDEO', 'SOCIAL', 'IA'],
    config: AI_VIRAL_VIDEO_PLAYBOOK,
    metadata: {
      objective: 'Generar un brief rápido para producir un video viral en redes sociales',
      deliverable: 'Brief de video con: idea viral, escenas detalladas, guión de audio y copy para publicar',
      estimatedTime: '2-3 minutos',
      requiredContext: [
        {
          tier: 1,
          types: ['brand_dna', 'tone_of_voice'],
          description: 'Para mantener la voz de marca en el contenido',
        },
      ],
      bestFor: [
        'Crear contenido para TikTok, Reels o Shorts',
        'Campañas de awareness',
        'Lanzamientos de producto',
        'Contenido educativo en formato corto',
      ],
      exampleOutput: '**Título**: "Lo que NO te dijeron sobre..." \n**Hook**: Close-up de cara sorprendida...',
    } as PlaybookMetadata,
  },
  'content-research': {
    name: 'Research & Calendario de Contenido',
    description: 'Investiga tendencias y genera un calendario de contenido estratégico alineado con tu marca.',
    category: 'strategy',
    tags: ['RESEARCH', 'CALENDARIO', 'ESTRATEGIA'],
    config: CONTENT_RESEARCH_PLAYBOOK,
    metadata: {
      objective: 'Investigar tendencias del mercado y crear un calendario editorial estratégico',
      deliverable: 'Reporte de tendencias + calendario de contenido para las próximas semanas',
      estimatedTime: '3-5 minutos',
      requiredContext: [
        {
          tier: 1,
          types: ['icp', 'brand_dna'],
          description: 'Para alinear el contenido con tu audiencia objetivo',
        },
        {
          tier: 2,
          types: ['competitor_analysis'],
          description: 'Para diferenciarte de la competencia',
        },
      ],
      bestFor: [
        'Planificación mensual de contenido',
        'Identificar oportunidades de contenido',
        'Alinear equipo de marketing',
      ],
    } as PlaybookMetadata,
  },
  'competitor-analysis': {
    name: 'Análisis de Competidor',
    description: 'Deep dive en un competidor con comparativa estratégica y recomendaciones.',
    category: 'research',
    tags: ['COMPETIDORES', 'RESEARCH', 'ESTRATEGIA'],
    config: COMPETITOR_ANALYSIS_PLAYBOOK,
    metadata: {
      objective: 'Analizar un competidor y encontrar oportunidades de diferenciación',
      deliverable: 'Perfil detallado del competidor + comparativa + recomendaciones estratégicas',
      estimatedTime: '2-4 minutos',
      requiredContext: [
        {
          tier: 1,
          types: ['brand_dna', 'icp'],
          description: 'Para comparar con tu propia propuesta de valor',
        },
      ],
      bestFor: [
        'Antes de lanzar una campaña',
        'Análisis trimestral de competencia',
        'Identificar gaps de mercado',
        'Preparar pitch de ventas',
      ],
      exampleOutput: '## Perfil: [Competidor]\n- Propuesta: ...\n- Fortalezas: ...\n## Oportunidades para nosotros: ...',
    } as PlaybookMetadata,
  },
} as const

export type PlaybookTemplateId = keyof typeof PLAYBOOK_TEMPLATES
